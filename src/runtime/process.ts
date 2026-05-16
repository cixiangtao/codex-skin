import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface ProcessIdentity {
  command: string
  startedAt: string
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
