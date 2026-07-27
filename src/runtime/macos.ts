import { execFile, spawn } from "node:child_process"
import { access } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type { CdpPortInspection, SpawnImplementation } from "./types.ts"
import { errorCode } from "./types.ts"

const execFileAsync = promisify(execFile)
const CODEX_BUNDLE_ID = "com.openai.codex"
const PROCESS_POLL_INTERVAL_MS = 250
const RUNNING_CODEX_PIDS_SCRIPT = `ObjC.import("AppKit");
const applications = $.NSRunningApplication.runningApplicationsWithBundleIdentifier(
  ${JSON.stringify(CODEX_BUNDLE_ID)},
);
JSON.stringify(ObjC.deepUnwrap(applications.valueForKey("processIdentifier")));`
const INSTALLED_CODEX_PATHS_SCRIPT = `ObjC.import("AppKit");
const urls = $.NSWorkspace.sharedWorkspace.URLsForApplicationsWithBundleIdentifier(
  ${JSON.stringify(CODEX_BUNDLE_ID)},
);
JSON.stringify(ObjC.deepUnwrap(urls.valueForKey("path")));`

interface WaitForCodexExitOptions {
  isCodexRunningImpl?: (appPath: string) => Promise<boolean>
  pollIntervalMs?: number
}

interface RunningApplicationsOptions {
  runningProcessIdsImpl?: () => Promise<number[]>
}

interface InstallationOptions {
  installedAppPathsImpl?: () => Promise<string[]>
  readBundleValueImpl?: (appPath: string, key: string) => Promise<string | null>
}

export interface MacProcess {
  command: string
  pid: number
  ppid: number
}

interface PortInspectionOptions extends RunningApplicationsOptions {
  listenerPidsImpl?: (port: number) => Promise<number[]>
  processTableImpl?: () => Promise<MacProcess[]>
}

async function readBundleValue(appPath: string, key: string) {
  try {
    const { stdout } = await execFileAsync("/usr/libexec/PlistBuddy", [
      "-c",
      `Print :${key}`,
      path.join(path.resolve(appPath), "Contents", "Info.plist"),
    ])
    return stdout.trim() || null
  } catch (error) {
    if (errorCode(error) === "1") return null
    throw error
  }
}

export function parseInstalledApplicationPaths(output: string) {
  const parsed = JSON.parse(output) as unknown
  if (!Array.isArray(parsed)) {
    throw new Error("Codex installation lookup returned invalid data.")
  }
  return [
    ...new Set(
      parsed
        .filter((value): value is string => typeof value === "string")
        .map((value) => path.resolve(value))
        .filter(Boolean),
    ),
  ]
}

/** Finds installed macOS application bundles by the stable Codex bundle identifier. */
export async function installedCodexAppPaths() {
  const { stdout } = await execFileAsync("/usr/bin/osascript", [
    "-l",
    "JavaScript",
    "-e",
    INSTALLED_CODEX_PATHS_SCRIPT,
  ])
  return parseInstalledApplicationPaths(stdout)
}

async function resolveCodexAppPath(appPath: string, options: InstallationOptions = {}) {
  const bundleValue = options.readBundleValueImpl || readBundleValue
  const configuredPath = path.resolve(appPath)
  if ((await bundleValue(configuredPath, "CFBundleIdentifier")) === CODEX_BUNDLE_ID) {
    return configuredPath
  }
  return (await (options.installedAppPathsImpl || installedCodexAppPaths)())[0] ?? null
}

/** Resolves the actual executable name from the application bundle metadata. */
export async function resolveAppExecutable(appPath: string, options: InstallationOptions = {}) {
  const bundleValue = options.readBundleValueImpl || readBundleValue
  const resolvedAppPath = await resolveCodexAppPath(appPath, options)
  if (!resolvedAppPath) throw new Error("Codex application is not installed.")
  const executableName = await bundleValue(resolvedAppPath, "CFBundleExecutable")
  if (!executableName || path.basename(executableName) !== executableName) {
    throw new Error("Codex application has an invalid CFBundleExecutable value.")
  }
  return path.join(resolvedAppPath, "Contents", "MacOS", executableName)
}

export function buildLaunchArguments(port: number) {
  return ["--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`]
}

export async function appExecutableExists(appPath: string, options: InstallationOptions = {}) {
  try {
    await access(await resolveAppExecutable(appPath, options))
    return true
  } catch {
    return false
  }
}

export function parseRunningApplicationPids(output: string) {
  const parsed = JSON.parse(output) as unknown
  if (!Array.isArray(parsed))
    throw new Error("Codex running application lookup returned invalid data.")
  return [
    ...new Set(
      parsed.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0),
    ),
  ]
}

/** Finds the native macOS application process by its stable bundle identifier. */
export async function runningCodexProcessIds() {
  const { stdout } = await execFileAsync("/usr/bin/osascript", [
    "-l",
    "JavaScript",
    "-e",
    RUNNING_CODEX_PIDS_SCRIPT,
  ])
  return parseRunningApplicationPids(stdout)
}

export function parseProcessTable(processList: string): MacProcess[] {
  const processes: MacProcess[] = []
  for (const line of processList.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/)
    if (!match) continue
    const [, rawPid, rawParentPid, command] = match
    if (!rawPid || !rawParentPid || !command) continue
    processes.push({ command, pid: Number(rawPid), ppid: Number(rawParentPid) })
  }
  return processes
}

async function readProcessTable() {
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "pid=,ppid=,command="])
  return parseProcessTable(stdout)
}

async function listenerPids(port: number) {
  try {
    const { stdout } = await execFileAsync("/usr/sbin/lsof", [
      "-nP",
      `-iTCP:${port}`,
      "-sTCP:LISTEN",
      "-t",
    ])
    return [
      ...new Set(
        stdout
          .split("\n")
          .map((value) => Number.parseInt(value.trim(), 10))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ]
  } catch (error) {
    if (errorCode(error) === "1") return []
    throw error
  }
}

export function processDescendsFrom(processes: MacProcess[], pid: number, ancestorPid: number) {
  const parents = new Map(processes.map((process) => [process.pid, process.ppid]))
  let current = pid
  for (let depth = 0; depth < 32; depth += 1) {
    if (current === ancestorPid) return true
    const parent = parents.get(current)
    if (!parent || parent === current || parent <= 1) return false
    current = parent
  }
  return false
}

/** Classifies a loopback port without trusting the service responding on it. */
export async function inspectCdpPort(
  _appPath: string,
  port: number,
  options: PortInspectionOptions = {},
): Promise<CdpPortInspection> {
  const listeners = await (options.listenerPidsImpl || listenerPids)(port)
  if (listeners.length === 0) return { codexPid: null, listenerPids: [], state: "available" }

  const processes = await (options.processTableImpl || readProcessTable)()
  const runningPids = await (options.runningProcessIdsImpl || runningCodexProcessIds)()
  const codexPid = runningPids.find(
    (pid) =>
      processes.some((process) => process.pid === pid) &&
      listeners.every((listenerPid) => processDescendsFrom(processes, listenerPid, pid)),
  )
  if (!codexPid) return { codexPid: null, listenerPids: listeners, state: "occupied" }

  return {
    codexPid,
    listenerPids: listeners,
    state: "codex",
  }
}

export async function findAvailableCdpPort(
  preferredPort: number,
  options: Pick<PortInspectionOptions, "listenerPidsImpl"> = {},
) {
  const lastPort = Math.min(65535, preferredPort + 100)
  for (let port = preferredPort; port <= lastPort; port += 1) {
    if ((await (options.listenerPidsImpl || listenerPids)(port)).length === 0) return port
  }
  throw new Error(`No free loopback port was found between ${preferredPort} and ${lastPort}.`)
}

export async function isCodexRunning(_appPath: string, options: RunningApplicationsOptions = {}) {
  return (await (options.runningProcessIdsImpl || runningCodexProcessIds)()).length > 0
}

/** Requests a normal application quit so Codex can persist its state before relaunch. */
export async function quitCodex() {
  await execFileAsync("/usr/bin/osascript", [
    "-e",
    `tell application id "${CODEX_BUNDLE_ID}" to quit`,
  ])
}

/** Keeps polling until the configured Codex main process has fully exited. */
export async function waitForCodexExit(appPath: string, options: WaitForCodexExitOptions = {}) {
  const running = options.isCodexRunningImpl || isCodexRunning
  while (await running(appPath)) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, options.pollIntervalMs ?? PROCESS_POLL_INTERVAL_MS),
    )
  }
}

/** Returns the native Codex application PID from the macOS application registry. */
export async function findCodexProcessId(
  _appPath: string,
  options: RunningApplicationsOptions = {},
) {
  return (await (options.runningProcessIdsImpl || runningCodexProcessIds)())[0] ?? null
}

export async function launchCodex({
  appPath,
  port,
  spawnImpl,
}: {
  appPath: string
  port: number
  spawnImpl?: SpawnImplementation
}) {
  const child = (spawnImpl || spawn)(
    await resolveAppExecutable(appPath),
    buildLaunchArguments(port),
    {
      detached: true,
      stdio: "ignore",
    },
  )
  child.unref()
  return child.pid
}
