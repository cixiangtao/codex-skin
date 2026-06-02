import { access } from "node:fs/promises"

import { isCdpAvailable } from "./cdp.ts"
import { configuredBackgroundSurfaces, writeConfig } from "./config.ts"
import { buildBackgroundCss, imageFileToDataUrl } from "./css.ts"
import { ensureDaemon, stopDaemon } from "./daemon.ts"
import { injectAllTargets, removeFromAllTargets } from "./injector.ts"
import {
  appExecutableExists,
  findAvailableCdpPort,
  inspectCdpPort,
  isCodexRunning,
  launchCodex,
  quitCodex,
  resolveAppExecutable,
  waitForCodexExit,
} from "./macos.ts"
import type { CdpPortInspection } from "./macos.ts"
import {
  BACKGROUND_SURFACES,
  type BackgroundApplication,
  type BackgroundConfig,
  type InjectionResult,
} from "./types.ts"

interface ServiceOptions {
  appExecutableExistsImpl?: (appPath: string) => Promise<boolean>
  ensureDaemonImpl?: (options: {
    entryPath: string
  }) => Promise<{ pid: number } & Record<string, unknown>>
  entryPath?: string
  dataDirectory?: string
  findAvailableCdpPortImpl?: (preferredPort: number) => Promise<number>
  injectAllTargetsImpl?: (options: { css: string; port: number }) => Promise<InjectionResult[]>
  isCdpAvailableImpl?: (options: { port: number }) => Promise<boolean>
  isCodexRunningImpl?: (appPath: string) => Promise<boolean>
  inspectCdpPortImpl?: (appPath: string, port: number) => Promise<CdpPortInspection>
  launchCodexImpl?: (options: { appPath: string; port: number }) => number | undefined
  quitCodexImpl?: () => Promise<void>
  removeFromAllTargetsImpl?: (options: { port: number }) => Promise<number>
  restartRunningCodex?: boolean
  stopDaemonImpl?: () => Promise<number | null>
  timeoutMs?: number
  waitForCodexExitImpl?: (appPath: string) => Promise<void>
  writeConfigImpl?: (config: BackgroundConfig) => Promise<BackgroundConfig>
}

export class BackgroundStateError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "BackgroundStateError"
    this.code = code
  }
}

async function inspectConfiguredPort(config: BackgroundConfig, options: ServiceOptions) {
  if (options.inspectCdpPortImpl) {
    return await options.inspectCdpPortImpl(config.appPath, config.port)
  }
  // Test callers that replace HTTP discovery do not have a real macOS process tree.
  if (options.isCdpAvailableImpl) {
    const ready = await options.isCdpAvailableImpl({ port: config.port })
    return {
      codexPid: null,
      listenerPids: [],
      state: ready ? "codex" : "available",
    } satisfies CdpPortInspection
  }
  return await inspectCdpPort(config.appPath, config.port)
}

export async function configuredCdpIsReady(config: BackgroundConfig, options: ServiceOptions = {}) {
  const inspection = await inspectConfiguredPort(config, options)
  const httpReady =
    inspection.state === "codex" &&
    (await (options.isCdpAvailableImpl || isCdpAvailable)({ port: config.port }))
  return { httpReady, inspection }
}

export async function waitForCdp(config: BackgroundConfig, options: ServiceOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if ((await configuredCdpIsReady(config, options)).httpReady) return true
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

async function validateConfiguredImages(config: BackgroundConfig) {
  const surfaces = configuredBackgroundSurfaces(config)
  if (surfaces.length === 0) return false
  await Promise.all(
    surfaces.map(async (surface) => {
      const image = config.surfaces[surface].image
      if (image) await imageFileToDataUrl(image)
    }),
  )
  return true
}

export async function syncConfiguredBackground(
  config: BackgroundConfig,
  options: ServiceOptions = {},
): Promise<BackgroundApplication> {
  const stop = options.stopDaemonImpl || stopDaemon
  const remove = options.removeFromAllTargetsImpl || removeFromAllTargets

  if (!config.enabled) {
    const pid = await stop()
    const { httpReady } = await configuredCdpIsReady(config, options)
    const targets = httpReady ? await remove({ port: config.port }) : 0
    return { applied: true, mode: "removed", pid, targets }
  }

  if (!(await validateConfiguredImages(config))) {
    const pid = await stop()
    const { httpReady } = await configuredCdpIsReady(config, options)
    const targets = httpReady ? await remove({ port: config.port }) : 0
    return { applied: true, mode: "removed", pid, targets }
  }
  const { httpReady, inspection } = await configuredCdpIsReady(config, options)
  if (inspection.state === "occupied") {
    throw new BackgroundStateError(
      "PORT_IN_USE",
      `Port ${config.port} is in use by a process that is not the configured Codex app.`,
    )
  }
  if (!httpReady) {
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
  if (!config.enabled) throw new BackgroundStateError("DISABLED", "Codex Skin is disabled.")
  if (!(await validateConfiguredImages(config))) {
    throw new BackgroundStateError("IMAGE_MISSING", "No background image is configured.")
  }
  if (!(await (options.appExecutableExistsImpl || appExecutableExists)(config.appPath))) {
    throw new BackgroundStateError(
      "APP_MISSING",
      `ChatGPT executable not found: ${resolveAppExecutable(config.appPath)}`,
    )
  }

  let running = await (options.isCodexRunningImpl || isCodexRunning)(config.appPath)
  let activeConfig = config
  let { httpReady, inspection } = await configuredCdpIsReady(activeConfig, options)
  if (inspection.state === "occupied") {
    if (running || config.portMode === "fixed") {
      throw new BackgroundStateError(
        "PORT_IN_USE",
        `Port ${config.port} is in use by a process that is not the configured Codex app.`,
      )
    }
    const port = await (options.findAvailableCdpPortImpl || findAvailableCdpPort)(config.port)
    const candidate = { ...config, port }
    const selected = await configuredCdpIsReady(candidate, options)
    if (selected.inspection.state !== "available") {
      throw new BackgroundStateError(
        "PORT_IN_USE",
        `Port ${port} became unavailable before Codex could start. Try again.`,
      )
    }
    activeConfig = await (options.writeConfigImpl || ((next) => writeConfig(next, options)))({
      ...config,
      port,
    })
    httpReady = selected.httpReady
  }
  if (running && !httpReady) {
    if (!options.restartRunningCodex) {
      throw new BackgroundStateError(
        "RESTART_REQUIRED",
        "Codex is running without background support. Quit Codex normally, keep this page open, then try again.",
      )
    }
    await (options.stopDaemonImpl || stopDaemon)()
    await (options.quitCodexImpl || quitCodex)()
    await (options.waitForCodexExitImpl || waitForCodexExit)(config.appPath)
    running = false
  }
  if (!running) {
    ;(options.launchCodexImpl || launchCodex)({
      appPath: activeConfig.appPath,
      port: activeConfig.port,
    })
    if (!(await waitForCdp(activeConfig, options))) {
      throw new BackgroundStateError(
        "CDP_TIMEOUT",
        "Codex started, but the background connection did not become available.",
      )
    }
  }

  const targets = await injectConfiguredBackground(activeConfig, options)
  if (!options.entryPath) throw new Error("The CLI entry path is required to start the daemon.")
  const daemon = await (options.ensureDaemonImpl || ensureDaemon)({ entryPath: options.entryPath })
  return { applied: true, mode: "started", port: activeConfig.port, targets, daemon }
}

export async function backgroundStatus(config: BackgroundConfig, options: ServiceOptions = {}) {
  const { httpReady, inspection } = await configuredCdpIsReady(config, options)
  const surfaceEntries = await Promise.all(
    BACKGROUND_SURFACES.map(async (surface) => {
      const image = config.surfaces[surface].image
      const imageReadable = image
        ? await access(image)
            .then(() => true)
            .catch(() => false)
        : false
      return [surface, { imageReadable }] as const
    }),
  )
  const surfaces = Object.fromEntries(surfaceEntries) as Record<
    (typeof BACKGROUND_SURFACES)[number],
    { imageReadable: boolean }
  >
  const imageReadable = configuredBackgroundSurfaces(config).some(
    (surface) => surfaces[surface].imageReadable,
  )
  return {
    cdpAvailable: httpReady,
    cdpPortState: inspection.state,
    imageReadable,
    surfaces,
  }
}
