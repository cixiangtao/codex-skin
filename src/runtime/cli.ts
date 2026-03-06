import { access } from "node:fs/promises"
import path from "node:path"

import { injectConfiguredBackground, startConfiguredBackground } from "./background-service.ts"
import { isCdpAvailable } from "./cdp.ts"
import { readConfig, resolveConfigPath, writeConfig } from "./config.ts"
import { imageFileToDataUrl } from "./css.ts"
import { readDaemonPid, runDaemon, stopDaemon } from "./daemon.ts"
import { removeFromAllTargets } from "./injector.ts"
import { appExecutableExists } from "./macos.ts"
import {
  ensureSettingsServer,
  openSettingsPage,
  runSettingsServerDaemon,
} from "./settings-server.ts"
import type { BackgroundConfig, BackgroundConfigInput } from "./types.ts"

type CommandOption = keyof BackgroundConfigInput | "disabled"

interface CommandIo {
  log(message: string): void
}

interface CliOptions {
  entryPath?: string
  io?: CommandIo
}

const OPTION_NAMES = new Map<string, CommandOption>([
  ["--image", "image"],
  ["--illustration-size", "illustrationSize"],
  ["--x", "illustrationX"],
  ["--y", "illustrationY"],
  ["--blur", "illustrationBlur"],
  ["--opacity", "illustrationOpacity"],
  ["--port", "port"],
  ["--app-path", "appPath"],
  ["--enable", "enabled"],
  ["--disable", "disabled"],
])
const BOOLEAN_OPTIONS = new Set(["--enable", "--disable"])

const HELP = `Codex Background

Usage:
  codex-background                       Open settings and start background mode
  codex-background settings              Open the visual settings page
  codex-background configure [options]   Update settings from the terminal
  codex-background doctor                Check the local runtime
  codex-background stop                  Remove the background

Options:
  --image PATH                 PNG, JPEG, WebP, GIF, or AVIF up to 25 MB
  --illustration-size 80..1200 Illustration width in pixels
  --x 0..100                   Horizontal illustration position
  --y 0..100                   Vertical illustration position
  --blur 0..30                 Illustration-only blur in pixels
  --opacity 0..1               Illustration-only opacity
  --port 1024..65535           Loopback CDP port (default 9229)
  --app-path PATH              ChatGPT.app location
`

export function parseArguments(argv: string[]) {
  const [command = "launch", ...tokens] = argv
  const options: Record<string, string | boolean> = {}
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (!token) continue
    const name = OPTION_NAMES.get(token)
    if (!name) throw new Error(`Unknown option: ${token}`)
    if (BOOLEAN_OPTIONS.has(token)) {
      options[name] = true
      continue
    }
    const value = tokens[index + 1]
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`)
    }
    options[name] = value
    index += 1
  }
  return { command, options }
}

function printableConfig(config: BackgroundConfig) {
  return `${JSON.stringify(config, null, 2)}\nConfig: ${resolveConfigPath()}`
}

async function configure(options: Record<string, string | boolean>, io: CommandIo) {
  const current = await readConfig()
  const updates: BackgroundConfigInput = { ...options }
  if (updates.disabled) {
    updates.enabled = false
    delete updates.disabled
  }
  if (typeof updates.image === "string") {
    updates.image = path.resolve(updates.image)
    await imageFileToDataUrl(updates.image)
  }
  const config = await writeConfig({ ...current, ...updates })
  io.log(printableConfig(config))
}

async function openSettings(entryPath: string, io: CommandIo) {
  const server = await ensureSettingsServer({ entryPath })
  openSettingsPage(server.url)
  io.log(`Opened settings at http://127.0.0.1:${server.port}/`)
  return server
}

async function launch(entryPath: string, io: CommandIo) {
  await openSettings(entryPath, io)
  const config = await readConfig()
  if (!config.image) {
    io.log("Choose a character image in the settings page to continue.")
    return
  }
  const result = await startConfiguredBackground(config, { entryPath })
  io.log(
    `Applied the background to ${result.targets ?? 0} Codex window${result.targets === 1 ? "" : "s"}.`,
  )
}

async function doctor(io: CommandIo) {
  const config = await readConfig()
  const [bunMajor = 0, bunMinor = 0] = Bun.version.split(".").map(Number)
  const supportedBun = bunMajor > 1 || (bunMajor === 1 && bunMinor >= 3)
  const checks: Array<[string, boolean]> = [
    ["Bun 1.3+", supportedBun],
    ["ChatGPT executable", await appExecutableExists(config.appPath)],
    ["Background image configured", Boolean(config.image)],
    [
      "Background image readable",
      config.image
        ? await access(config.image)
            .then(() => true)
            .catch(() => false)
        : false,
    ],
    [`CDP 127.0.0.1:${config.port}`, await isCdpAvailable({ port: config.port })],
    ["Background daemon", Boolean(await readDaemonPid())],
  ]
  for (const [label, passed] of checks) io.log(`${passed ? "✓" : "·"} ${label}`)
  io.log(`Config: ${resolveConfigPath()}`)
  return checks.slice(0, 4).every(([, passed]) => passed) ? 0 : 1
}

export async function runCli(argv: string[], options: CliOptions = {}) {
  const io = options.io || console
  const entryPath = options.entryPath || process.argv[1]
  if (!entryPath) throw new Error("Unable to resolve the CLI entry path.")
  const { command, options: commandOptions } = parseArguments(argv)
  switch (command) {
    case "launch":
      await launch(entryPath, io)
      return 0
    case "help":
    case "--help":
    case "-h":
      io.log(HELP)
      return 0
    case "configure":
      await configure(commandOptions, io)
      return 0
    case "settings":
      await openSettings(entryPath, io)
      return 0
    case "show":
      io.log(printableConfig(await readConfig()))
      return 0
    case "doctor":
      return await doctor(io)
    case "start": {
      const result = await startConfiguredBackground(await readConfig(), { entryPath })
      io.log(`Injected ${result.targets ?? 0} Codex window(s).`)
      return 0
    }
    case "inject": {
      const config = await readConfig()
      if (!(await isCdpAvailable({ port: config.port }))) {
        throw new Error(`CDP is not available on 127.0.0.1:${config.port}.`)
      }
      io.log(`Injected ${await injectConfiguredBackground(config)} Codex window(s).`)
      return 0
    }
    case "stop": {
      const config = await readConfig()
      const pid = await stopDaemon()
      if (await isCdpAvailable({ port: config.port })) {
        await removeFromAllTargets({ port: config.port })
      }
      io.log(pid ? `Stopped background daemon ${pid}.` : "Background daemon was not running.")
      return 0
    }
    case "enable": {
      const config = await readConfig()
      await writeConfig({ ...config, enabled: true })
      io.log("Codex Background enabled.")
      return 0
    }
    case "disable": {
      const config = await readConfig()
      await writeConfig({ ...config, enabled: false })
      await stopDaemon()
      if (await isCdpAvailable({ port: config.port })) {
        await removeFromAllTargets({ port: config.port })
      }
      io.log("Codex Background disabled. Codex itself was left running.")
      return 0
    }
    case "daemon":
      await runDaemon()
      return 0
    case "settings-server":
      await runSettingsServerDaemon({ entryPath })
      return 0
    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`)
  }
}
