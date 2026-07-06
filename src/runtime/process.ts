import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"

import { errorCode } from "./types.ts"

const execFileAsync = promisify(execFile)

export interface ProcessIdentity {
  command: string
  startedAt: string
}

export interface ProcessSummary {
  command: string
  pid: number
}

interface TerminateProcessOptions {
  inspectProcessImpl?: (pid: number) => Promise<ProcessIdentity | null>
  killProcessImpl?: (pid: number, signal: NodeJS.Signals) => void
  timeoutMs?: number
}

/** Matches a directly launched Codex Skin runtime subcommand. */
export function codexSkinProcessCommandMatches(command: string, subcommand: string) {
  const tokens = command.trim().split(/\s+/)
  if (tokens.at(-1) !== subcommand) return false
  const entry = path.basename(tokens.at(-2) || "")
  if (!/^codex-skin(?:\.(?:js|ts))?$/.test(entry)) return false
  if (tokens.length === 2) return true
  if (tokens.length !== 3) return false
  return /^(?:bun|node)$/.test(path.basename(tokens[0] || ""))
}

/** Compares the command and OS start time so recycled PIDs are never treated as owned. */
export function processIdentityMatches(expected: ProcessIdentity, actual: ProcessIdentity | null) {
  return (
    actual !== null &&
    actual.command === expected.command &&
    actual.startedAt === expected.startedAt
  )
}

/** Parses the macOS process table while ignoring malformed or empty rows. */
export function parseProcessList(output: string): ProcessSummary[] {
  return output
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ command: match[2] || "", pid: Number.parseInt(match[1] || "", 10) }))
}

/** Lists running processes for narrowly scoped Codex Skin ownership checks. */
export async function listProcesses(): Promise<ProcessSummary[]> {
  const { stdout } = await execFileAsync("ps", ["-axo", "pid=,command="], {
    maxBuffer: 4 * 1024 * 1024,
  })
  return parseProcessList(stdout)
}

/** Reads the command and OS start time used to distinguish a process from a recycled PID. */
export async function inspectProcess(pid: number): Promise<ProcessIdentity | null> {
  if (!Number.isInteger(pid) || pid <= 0) return null
  try {
    const [{ stdout: startedAt }, { stdout: command }] = await Promise.all([
      execFileAsync("ps", ["-p", String(pid), "-o", "lstart="]),
      execFileAsync("ps", ["-p", String(pid), "-o", "command="]),
    ])
    if (!startedAt.trim() || !command.trim()) return null
    return { command: command.trim(), startedAt: startedAt.trim() }
  } catch {
    return null
  }
}

/** Terminates every owned PID and waits until none of them remain. */
export async function terminateProcesses(pids: number[], options: TerminateProcessOptions = {}) {
  const uniquePids = [...new Set(pids)].filter((pid) => pid !== process.pid)
  const kill = options.killProcessImpl || process.kill
  for (const pid of uniquePids) {
    try {
      kill(pid, "SIGTERM")
    } catch (error) {
      if (errorCode(error) !== "ESRCH") throw error
    }
  }

  const inspect = options.inspectProcessImpl || inspectProcess
  const deadline = Date.now() + (options.timeoutMs ?? 5000)
  const remaining = new Set(uniquePids)
  while (remaining.size > 0 && Date.now() < deadline) {
    const states = await Promise.all(
      [...remaining].map(async (pid) => [pid, await inspect(pid)] as const),
    )
    for (const [pid, state] of states) {
      if (!state) remaining.delete(pid)
    }
    if (remaining.size > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }
  }
  if (remaining.size > 0) {
    throw new Error(`Background processes did not stop safely: ${[...remaining].join(", ")}.`)
  }
}
