import { access } from "node:fs/promises"

import { isCdpAvailable } from "./cdp.ts"
import { buildBackgroundCss, imageFileToDataUrl } from "./css.ts"
import { ensureDaemon, stopDaemon } from "./daemon.ts"
import { injectAllTargets, removeFromAllTargets } from "./injector.ts"
import { appExecutableExists, isCodexRunning, launchCodex, resolveAppExecutable } from "./macos.ts"
import type { BackgroundApplication, BackgroundConfig, InjectionResult } from "./types.ts"

interface ServiceOptions {
  appExecutableExistsImpl?: (appPath: string) => Promise<boolean>
  ensureDaemonImpl?: (options: {
    entryPath: string
  }) => Promise<{ pid: number } & Record<string, unknown>>
  entryPath?: string
  injectAllTargetsImpl?: (options: { css: string; port: number }) => Promise<InjectionResult[]>
  isCdpAvailableImpl?: (options: { port: number }) => Promise<boolean>
  isCodexRunningImpl?: (appPath: string) => Promise<boolean>
  launchCodexImpl?: (options: { appPath: string; port: number }) => number | undefined
  removeFromAllTargetsImpl?: (options: { port: number }) => Promise<number>
  stopDaemonImpl?: () => Promise<number | null>
  timeoutMs?: number
}

export class BackgroundStateError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "BackgroundStateError"
    this.code = code
  }
}

export async function waitForCdp(port: number, options: ServiceOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000
  const isAvailable = options.isCdpAvailableImpl || isCdpAvailable
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isAvailable({ port })) return true
    await new Promise<void>((resolve) => setTimeout(resolve, 250))
  }
  return false
}

export async function injectConfiguredBackground(
  config: BackgroundConfig,
  options: ServiceOptions = {},
) {
  const css = await buildBackgroundCss(config)
  const inject = options.injectAllTargetsImpl || injectAllTargets
  const results = await inject({ css, port: config.port })
  const successes = results.filter((result) => result.ok)
  if (successes.length === 0) {
    const details = results
      .map((result) => result.error)
      .filter(Boolean)
      .join("; ")
    throw new BackgroundStateError(
      "NO_TARGETS",
      `No Codex window accepted the background.${details ? ` ${details}` : ""}`,
    )
  }
  return successes.length
}

export async function syncConfiguredBackground(
  config: BackgroundConfig,
  options: ServiceOptions = {},
): Promise<BackgroundApplication> {
  const isAvailable = options.isCdpAvailableImpl || isCdpAvailable
  const stop = options.stopDaemonImpl || stopDaemon
  const remove = options.removeFromAllTargetsImpl || removeFromAllTargets

  if (!config.enabled) {
    const pid = await stop()
    const targets = (await isAvailable({ port: config.port }))
      ? await remove({ port: config.port })
      : 0
    return { applied: true, mode: "removed", pid, targets }
  }

  if (!config.image) return { applied: false, mode: "saved", reason: "image-missing" }
  await imageFileToDataUrl(config.image)
  if (!(await isAvailable({ port: config.port }))) {
    return { applied: false, mode: "saved", reason: "cdp-unavailable" }
  }

  const targets = await injectConfiguredBackground(config, options)
  const daemon = options.entryPath
    ? await (options.ensureDaemonImpl || ensureDaemon)({ entryPath: options.entryPath })
    : undefined
  return { applied: true, mode: "injected", targets, daemon }
}

export async function startConfiguredBackground(
  config: BackgroundConfig,
  options: ServiceOptions = {},
): Promise<BackgroundApplication> {
  if (!config.enabled) throw new BackgroundStateError("DISABLED", "Codex Background is disabled.")
  if (!config.image) {
    throw new BackgroundStateError("IMAGE_MISSING", "No background image is configured.")
  }
  await imageFileToDataUrl(config.image)
  if (!(await (options.appExecutableExistsImpl || appExecutableExists)(config.appPath))) {
    throw new BackgroundStateError(
      "APP_MISSING",
      `ChatGPT executable not found: ${resolveAppExecutable(config.appPath)}`,
    )
  }

  const running = await (options.isCodexRunningImpl || isCodexRunning)(config.appPath)
  const cdpAvailable = await (options.isCdpAvailableImpl || isCdpAvailable)({ port: config.port })
  if (running && !cdpAvailable) {
    throw new BackgroundStateError(
      "RESTART_REQUIRED",
      "Codex is running without background support. Quit Codex normally, keep this page open, then try again.",
    )
  }
  if (!running) {
    ;(options.launchCodexImpl || launchCodex)({ appPath: config.appPath, port: config.port })
    if (!(await waitForCdp(config.port, options))) {
      throw new BackgroundStateError(
        "CDP_TIMEOUT",
        "Codex started, but the background connection did not become available.",
      )
    }
  }

  const targets = await injectConfiguredBackground(config, options)
  if (!options.entryPath) throw new Error("The CLI entry path is required to start the daemon.")
  const daemon = await (options.ensureDaemonImpl || ensureDaemon)({ entryPath: options.entryPath })
  return { applied: true, mode: "started", targets, daemon }
}

export async function backgroundStatus(config: BackgroundConfig, options: ServiceOptions = {}) {
  const imageReadable = config.image
    ? await access(config.image)
        .then(() => true)
        .catch(() => false)
    : false
  return {
    cdpAvailable: await (options.isCdpAvailableImpl || isCdpAvailable)({ port: config.port }),
    imageReadable,
  }
}
