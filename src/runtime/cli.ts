import { access } from "node:fs/promises"
import path from "node:path"

import pc from "picocolors"

import packageManifest from "../../package.json" with { type: "json" }
import {
  configuredCdpIsReady,
  injectConfiguredBackground,
  startConfiguredBackground,
} from "./background-service.ts"
import {
  configuredBackgroundSurfaces,
  readConfig,
  resolveConfigPath,
  writeConfig,
} from "./config.ts"
import { buildBackgroundCss, imageFileToDataUrl } from "./css.ts"
import { readDaemonPid, runDaemon, stopDaemon } from "./daemon.ts"
import { removeFromAllTargets, verifyAllTargets } from "./injector.ts"
import type { TargetVerification } from "./injector.ts"
import { appExecutableExists, confirmCodexRestart, isCodexRunning } from "./macos.ts"
import {
  ensureSettingsServer,
  listenSettingsServer,
  openSettingsPage,
  runSettingsServerDaemon,
  stopSettingsServer,
} from "./settings-server.ts"
import type { BackgroundConfig, BackgroundSurface } from "./types.ts"

type CommandOption =
  | "appPath"
  | "autoPort"
  | "disabled"
  | "enabled"
  | "image"
  | "illustrationBlur"
  | "illustrationOpacity"
  | "illustrationSize"
  | "illustrationX"
  | "illustrationY"
  | "port"
  | "reload"
  | "surface"
  | "surfaceDisabled"
  | "surfaceEnabled"

interface CommandIo {
  log(message: string): void
}

interface CliOptions {
  colors?: typeof pc
  confirmCodexRestartImpl?: () => Promise<boolean>
  entryPath?: string
  io?: CommandIo
  version?: string
}

interface RuntimeSummary {
  cdpPort: number
  daemonPid?: number | null
  settingsPid: number
  settingsPort: number
}

const OPTION_NAMES = new Map<string, CommandOption>([
  ["--image", "image"],
  ["--surface", "surface"],
  ["--enable-surface", "surfaceEnabled"],
  ["--disable-surface", "surfaceDisabled"],
  ["--illustration-size", "illustrationSize"],
  ["--x", "illustrationX"],
  ["--y", "illustrationY"],
  ["--blur", "illustrationBlur"],
  ["--opacity", "illustrationOpacity"],
  ["--port", "port"],
  ["--app-path", "appPath"],
  ["--enable", "enabled"],
  ["--disable", "disabled"],
  ["--reload", "reload"],
  ["--auto-port", "autoPort"],
])
const BOOLEAN_OPTIONS = new Set([
  "--auto-port",
  "--enable",
  "--disable",
  "--enable-surface",
  "--disable-surface",
  "--reload",
])
const DEVELOPMENT_API_PORT = 4179
const DEVELOPMENT_UI_URL = "http://127.0.0.1:4178/"
const PACKAGE_VERSION = packageManifest.version

const HELP = `Codex Skin

Usage:
  codex-skin                       Open settings and start background mode
  codex-skin settings              Open the visual settings page
  codex-skin configure [options]   Update settings from the terminal
  codex-skin doctor                Check the local runtime
  codex-skin verify [--reload]     Verify the visible background
  codex-skin stop                  Stop background and settings services

Options:
  --image PATH                 PNG, JPEG, WebP, GIF, or AVIF up to 25 MB
  --surface main|sidebar       Target surface for image and appearance options
  --enable-surface             Enable the selected surface
  --disable-surface            Disable the selected surface
  --illustration-size 80..1200 Illustration width in pixels
  --x 0..100                   Horizontal illustration position
  --y 0..100                   Vertical illustration position
  --blur 0..30                 Illustration-only blur in pixels
  --opacity 0..1               Illustration-only opacity
  --port 1024..65535           Loopback CDP port (default 9229)
  --auto-port                  Automatically move away from port collisions
  --app-path PATH              ChatGPT.app location
  --reload                     Reload Codex before functional verification
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
  const surface = String(options.surface || "main")
  if (surface !== "main" && surface !== "sidebar") {
    throw new Error(`Unknown background surface: ${surface}`)
  }
  const selectedSurface = surface as BackgroundSurface
  const next: BackgroundConfig = {
    ...current,
    enabled: options.disabled ? false : options.enabled ? true : current.enabled,
    port:
      options.port === undefined || !Number.isFinite(Number(options.port))
        ? current.port
        : Number(options.port),
    portMode: options.autoPort ? "auto" : options.port !== undefined ? "fixed" : current.portMode,
    appPath: typeof options.appPath === "string" ? options.appPath : current.appPath,
    surfaces: {
      ...current.surfaces,
      [selectedSurface]: {
        ...current.surfaces[selectedSurface],
        ...(options.surfaceDisabled ? { enabled: false } : {}),
        ...(options.surfaceEnabled ? { enabled: true } : {}),
      },
    },
  }

  const surfaceUpdates = next.surfaces[selectedSurface]
  if (typeof options.image === "string") {
    surfaceUpdates.image = path.resolve(options.image)
    surfaceUpdates.enabled = true
    await imageFileToDataUrl(surfaceUpdates.image)
  }
  for (const key of [
    "illustrationSize",
    "illustrationX",
    "illustrationY",
    "illustrationBlur",
    "illustrationOpacity",
  ] as const) {
    if (options[key] !== undefined) surfaceUpdates[key] = Number(options[key])
  }
  const config = await writeConfig(next)
  io.log(printableConfig(config))
}

async function openSettings(entryPath: string) {
  const server = await ensureSettingsServer({ entryPath })
  openSettingsPage(server.url)
  return server
}

/** Formats the copyable runtime details shown after opening the settings interface. */
export function formatRuntimeSummary(
  { cdpPort, daemonPid, settingsPid, settingsPort }: RuntimeSummary,
  { colors = pc, version = PACKAGE_VERSION }: Pick<CliOptions, "colors" | "version"> = {},
) {
  const label = (value: string) => colors.bold(colors.white(value.padEnd(10)))
  const running = colors.green("running")
  const backgroundStatus = daemonPid
    ? `${running} ${colors.dim("·")} PID ${colors.cyan(daemonPid)}`
    : colors.yellow("waiting to start")
  const stopCommand = "npx codex-skin stop"

  return [
    `${colors.bold(colors.magenta("Codex Skin"))} ${colors.dim(`v${version}`)}`,
    "",
    `  ${label("Settings")} ${running} ${colors.dim("·")} PID ${colors.cyan(settingsPid)} ${colors.dim("·")} ${colors.cyan(`127.0.0.1:${settingsPort}`)}`,
    `  ${label("Background")} ${backgroundStatus}`,
    `  ${label("Codex CDP")} ${colors.cyan(`127.0.0.1:${cdpPort}`)}`,
    `  ${label("Stop")} ${colors.yellow(stopCommand)}`,
  ].join("\n")
}

function logRuntimeSummary(
  io: CommandIo,
  summary: RuntimeSummary,
  options: Pick<CliOptions, "colors" | "version">,
) {
  io.log(formatRuntimeSummary(summary, options))
}

async function runDevelopmentServer(entryPath: string, io: CommandIo) {
  const instance = await listenSettingsServer({
    authenticatedRedirectUrl: DEVELOPMENT_UI_URL,
    entryPath,
    idleTimeoutMs: 24 * 60 * 60 * 1000,
    port: DEVELOPMENT_API_PORT,
    token: process.env.CODEX_SKIN_DEV_TOKEN,
  })
  io.log(`Development API: http://127.0.0.1:${DEVELOPMENT_API_PORT}/`)
  io.log(`Authenticate the Vite UI: ${instance.url}`)

  const close = () => instance.server.close()
  process.once("SIGTERM", close)
  process.once("SIGINT", close)
  await new Promise<void>((resolve) => instance.server.once("close", resolve))
}

async function launch(entryPath: string, io: CommandIo, options: CliOptions) {
  const config = await readConfig()
  if (configuredBackgroundSurfaces(config).length === 0) {
    const server = await openSettings(entryPath)
    logRuntimeSummary(
      io,
      {
        cdpPort: config.port,
        daemonPid: await readDaemonPid(),
        settingsPid: server.pid,
        settingsPort: server.port,
      },
      options,
    )
    io.log("Choose a character image in the settings page to continue.")
    return 0
  }

  let restartRunningCodex = false
  if (await isCodexRunning(config.appPath)) {
    const { httpReady, inspection } = await configuredCdpIsReady(config)
    if (!httpReady && inspection.state !== "occupied") {
      restartRunningCodex = await (options.confirmCodexRestartImpl || confirmCodexRestart)()
      if (!restartRunningCodex) {
        io.log("Codex Skin did not start. Quit Codex completely, then run codex-skin again.")
        return 0
      }
    }
  }

  const server = await openSettings(entryPath)
  const result = await startConfiguredBackground(config, { entryPath, restartRunningCodex })
  logRuntimeSummary(
    io,
    {
      cdpPort: result.port ?? config.port,
      daemonPid: result.daemon?.pid,
      settingsPid: server.pid,
      settingsPort: server.port,
    },
    options,
  )
  io.log(
    `Applied the background to ${result.targets ?? 0} Codex window${result.targets === 1 ? "" : "s"}.`,
  )
  return 0
}

async function requireConfiguredCdp(config: BackgroundConfig) {
  const { httpReady, inspection } = await configuredCdpIsReady(config)
  if (inspection.state === "occupied") {
    throw new Error(`Port ${config.port} is not owned by the configured Codex app.`)
  }
  if (!httpReady) throw new Error(`CDP is not available on 127.0.0.1:${config.port}.`)
}

export function verificationChecks(result: TargetVerification) {
  const checks: Array<readonly [string, boolean]> = [
    ["injection marker enabled", result.enabled],
    ["background style present", result.stylePresent],
    ["configuration hash matches", result.hashMatches],
  ]
  if (result.surfaces) {
    for (const [surface, verification] of Object.entries(result.surfaces)) {
      if (!verification.expected) continue
      checks.push([`${surface} surface found`, verification.present])
      checks.push([`${surface} background image active`, verification.pass])
    }
  } else {
    checks.push(["workspace surface found", result.surfacePresent])
    checks.push([
      "pseudo-element background image active",
      result.backgroundImage !== "" && result.backgroundImage !== "none",
    ])
  }
  checks.push(["decorative layer ignores pointer events", result.pointerEvents === "none"])
  return checks
}

export function isSupportedNodeVersion(version = process.versions.node) {
  const major = Number.parseInt(version.split(".", 1)[0] || "0", 10)
  return major >= 22
}

async function doctor(io: CommandIo) {
  const config = await readConfig()
  const cdp = await configuredCdpIsReady(config)
  const configuredSurfaces = configuredBackgroundSurfaces(config)
  const configuredImagesReadable =
    configuredSurfaces.length > 0 &&
    (
      await Promise.all(
        configuredSurfaces.map(async (surface) => {
          const image = config.surfaces[surface].image
          return image
            ? await access(image)
                .then(() => true)
                .catch(() => false)
            : false
        }),
      )
    ).every(Boolean)
  const checks: Array<[string, boolean]> = [
    ["Node.js 22+", isSupportedNodeVersion()],
    ["ChatGPT executable", await appExecutableExists(config.appPath)],
    ["Background image configured", configuredSurfaces.length > 0],
    ["Background image readable", configuredImagesReadable],
    [`Codex-owned CDP 127.0.0.1:${config.port}`, cdp.httpReady],
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
      return await launch(entryPath, io, options)
    case "help":
    case "--help":
    case "-h":
      io.log(HELP)
      return 0
    case "configure":
      await configure(commandOptions, io)
      return 0
    case "settings":
      {
        const [config, server, daemonPid] = await Promise.all([
          readConfig(),
          openSettings(entryPath),
          readDaemonPid(),
        ])
        logRuntimeSummary(
          io,
          {
            cdpPort: config.port,
            daemonPid,
            settingsPid: server.pid,
            settingsPort: server.port,
          },
          options,
        )
      }
      return 0
    case "show":
      io.log(printableConfig(await readConfig()))
      return 0
    case "doctor":
      return await doctor(io)
    case "verify": {
      const config = await readConfig()
      await requireConfiguredCdp(config)
      const results = await verifyAllTargets({
        css: await buildBackgroundCss(config),
        port: config.port,
        reload: commandOptions.reload === true,
      })
      for (const result of results) {
        const label = result.title || result.url || result.id || "Codex window"
        io.log(`${result.pass ? "✓" : "✗"} ${label}${result.error ? ` — ${result.error}` : ""}`)
        if (!result.pass) {
          for (const [check, passed] of verificationChecks(result)) {
            io.log(`  ${passed ? "✓" : "✗"} ${check}`)
          }
        }
      }
      return results.length > 0 && results.every((result) => result.pass) ? 0 : 1
    }
    case "start": {
      const result = await startConfiguredBackground(await readConfig(), { entryPath })
      io.log(`Injected ${result.targets ?? 0} Codex window(s).`)
      return 0
    }
    case "inject": {
      const config = await readConfig()
      await requireConfiguredCdp(config)
      io.log(`Injected ${await injectConfiguredBackground(config)} Codex window(s).`)
      return 0
    }
    case "stop": {
      const config = await readConfig()
      const [daemonPid, settingsServerPid] = await Promise.all([stopDaemon(), stopSettingsServer()])
      if ((await configuredCdpIsReady(config)).httpReady) {
        await removeFromAllTargets({ port: config.port })
      }
      io.log(
        daemonPid
          ? `Stopped background daemon ${daemonPid}.`
          : "Background daemon was not running.",
      )
      io.log(
        settingsServerPid
          ? `Stopped settings server ${settingsServerPid}.`
          : "Settings server was not running.",
      )
      return 0
    }
    case "enable": {
      const config = await readConfig()
      await writeConfig({ ...config, enabled: true })
      io.log("Codex Skin enabled.")
      return 0
    }
    case "disable": {
      const config = await readConfig()
      await writeConfig({ ...config, enabled: false })
      await stopDaemon()
      if ((await configuredCdpIsReady(config)).httpReady) {
        await removeFromAllTargets({ port: config.port })
      }
      io.log("Codex Skin disabled. Codex itself was left running.")
      return 0
    }
    case "daemon":
      await runDaemon({ entryPath })
      return 0
    case "settings-server":
      await runSettingsServerDaemon({ entryPath })
      return 0
    case "dev-server":
      await runDevelopmentServer(entryPath, io)
      return 0
    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`)
  }
}
