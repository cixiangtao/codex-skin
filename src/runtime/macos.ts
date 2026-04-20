import { execFile, spawn } from "node:child_process"
import { access } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type { SpawnImplementation } from "./types.ts"
import { errorCode } from "./types.ts"

const execFileAsync = promisify(execFile)
const CODEX_BUNDLE_ID = "com.openai.codex"
const PROCESS_POLL_INTERVAL_MS = 250

export interface MacProcess {
  command: string
  pid: number
  ppid: number
}

export interface CdpPortInspection {
  codexPid: number | null
  listenerPids: number[]
  state: "available" | "codex" | "occupied"
}

interface PortInspectionOptions {
  listenerPidsImpl?: (port: number) => Promise<number[]>
  processTableImpl?: () => Promise<MacProcess[]>
}

export function resolveAppExecutable(appPath: string) {
  return path.join(path.resolve(appPath), "Contents", "MacOS", "ChatGPT")
}

export function buildLaunchArguments(port: number) {
  return ["--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`]
}

export async function appExecutableExists(appPath: string) {
  try {
    await access(resolveAppExecutable(appPath))
    return true
  } catch {
    return false
  }
}

export function processListContainsExecutable(processList: string, executable: string) {
  return processList
    .split("\n")
    .some((command) => command === executable || command.startsWith(`${executable} `))
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
  appPath: string,
  port: number,
  options: PortInspectionOptions = {},
): Promise<CdpPortInspection> {
  const listeners = await (options.listenerPidsImpl || listenerPids)(port)
  if (listeners.length === 0) return { codexPid: null, listenerPids: [], state: "available" }

  const processes = await (options.processTableImpl || readProcessTable)()
  const executable = resolveAppExecutable(appPath)
  const codex = processes.find(
    ({ command }) => command === executable || command.startsWith(`${executable} `),
  )
  if (!codex) return { codexPid: null, listenerPids: listeners, state: "occupied" }

  const owned = listeners.every((pid) => processDescendsFrom(processes, pid, codex.pid))
  return {
    codexPid: codex.pid,
    listenerPids: listeners,
    state: owned ? "codex" : "occupied",
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

export async function isCodexRunning(appPath: string) {
  const executable = resolveAppExecutable(appPath)
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "command="])
  return processListContainsExecutable(stdout, executable)
}

/** Asks the user whether Codex Skin may restart an already-running Codex app. */
export async function confirmCodexRestart() {
  try {
    const { stdout } = await execFileAsync("/usr/bin/osascript", [
      "-e",
      'button returned of (display dialog "Codex is already running without background support. Restart Codex now to start background mode? If you exit Codex Skin, quit Codex completely before trying again." with title "Codex Skin" buttons {"Exit Codex Skin", "Restart Codex"} default button "Restart Codex" cancel button "Exit Codex Skin" with icon caution)',
    ])
    return stdout.trim() === "Restart Codex"
  } catch (error) {
    // Closing the dialog or selecting its cancel button returns AppleScript error -128.
    if (errorCode(error) === "1") return false
    throw error
  }
}

/** Requests a normal application quit so Codex can persist its state before relaunch. */
export async function quitCodex() {
  await execFileAsync("/usr/bin/osascript", [
    "-e",
    `tell application id "${CODEX_BUNDLE_ID}" to quit`,
  ])
}

/** Waits until the configured Codex main process has fully exited. */
export async function waitForCodexExit(appPath: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await isCodexRunning(appPath))) return true
    await new Promise<void>((resolve) => setTimeout(resolve, PROCESS_POLL_INTERVAL_MS))
  }
  return !(await isCodexRunning(appPath))
}

/** Returns the main ChatGPT process id, excluding renderer and helper processes. */
export async function findCodexProcessId(appPath: string) {
  const executable = resolveAppExecutable(appPath)
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "pid=,command="])
  for (const line of stdout.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/)
    if (!match) continue
    const [, rawPid, command] = match
    if (command === executable || command?.startsWith(`${executable} `)) return Number(rawPid)
  }
  return null
}

export function launchCodex({
  appPath,
  port,
  spawnImpl,
}: {
  appPath: string
  port: number
  spawnImpl?: SpawnImplementation
}) {
  const child = (spawnImpl || spawn)(resolveAppExecutable(appPath), buildLaunchArguments(port), {
    detached: true,
    stdio: "ignore",
  })
  child.unref()
  return child.pid
}
