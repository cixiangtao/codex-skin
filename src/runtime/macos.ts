import { execFile, spawn } from "node:child_process"
import { access } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type { SpawnImplementation } from "./types.ts"

const execFileAsync = promisify(execFile)

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

export async function isCodexRunning(appPath: string) {
  const executable = resolveAppExecutable(appPath)
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "command="])
  return processListContainsExecutable(stdout, executable)
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
