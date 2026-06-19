import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface ProcessIdentity {
  command: string
  startedAt: string
}

export interface ProcessSummary {
  command: string
  pid: number
}

/** Parses the macOS process table while ignoring malformed or empty rows. */
export function parseProcessList(output: string): ProcessSummary[] {
  return output
    .split("\n")
    .map((line) => /^\s*(\d+)\s+(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ command: match[2], pid: Number.parseInt(match[1], 10) }))
}

/** Lists running processes for narrowly scoped daemon ownership checks. */
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
