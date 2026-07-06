import { spawn } from "node:child_process"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { resolveDataDirectory } from "./config.ts"
import {
  codexSkinProcessCommandMatches,
  inspectProcess,
  listProcesses,
  processIdentityMatches,
  terminateProcesses,
} from "./process.ts"
import type { ProcessIdentity, ProcessSummary } from "./process.ts"
import type { DataDirectoryOptions, SpawnImplementation } from "./types.ts"
import { errorCode } from "./types.ts"

interface RestartWorkerIdentity extends ProcessIdentity {
  pid: number
}

interface RestartWorkerProcessOptions extends DataDirectoryOptions {
  inspectProcessImpl?: (pid: number) => Promise<ProcessIdentity | null>
  killProcessImpl?: (pid: number, signal: NodeJS.Signals) => void
  listProcessesImpl?: () => Promise<ProcessSummary[]>
}

interface StartRestartWorkerOptions extends DataDirectoryOptions {
  entryPath: string
  spawnImpl?: SpawnImplementation
}

interface RunRestartWorkerOptions extends RestartWorkerProcessOptions {
  task: () => Promise<void>
}

function runtimePaths(options: DataDirectoryOptions = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return {
    dataDirectory,
    lock: path.join(dataDirectory, "restart-worker.lock"),
    process: path.join(dataDirectory, "restart-worker.json"),
  }
}

async function readIdentityFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as RestartWorkerIdentity
  } catch (error) {
    if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

async function readVerifiedIdentity(filePath: string, options: RestartWorkerProcessOptions) {
  const identity = await readIdentityFile(filePath)
  if (!identity) return null
  const actual = await (options.inspectProcessImpl || inspectProcess)(identity.pid)
  return processIdentityMatches(identity, actual) ? identity : null
}

async function claimRestartWorkerLock(
  identity: RestartWorkerIdentity,
  options: RestartWorkerProcessOptions,
) {
  const lockPath = runtimePaths(options).lock
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFile(lockPath, `${JSON.stringify(identity, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      })
      return true
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error
      if (await readVerifiedIdentity(lockPath, options)) return false
      await rm(lockPath, { force: true })
    }
  }
  return false
}

async function releaseRestartWorkerLock(pid: number, options: RestartWorkerProcessOptions) {
  const lockPath = runtimePaths(options).lock
  const owner = await readIdentityFile(lockPath)
  if (owner?.pid === pid) await rm(lockPath, { force: true })
}

/** Returns every independently launched restart worker except the caller. */
export function restartWorkerPidsFromProcesses(
  processes: ProcessSummary[],
  currentPid = process.pid,
) {
  return processes
    .filter(
      ({ command, pid }) =>
        pid !== currentPid && codexSkinProcessCommandMatches(command, "restart-worker"),
    )
    .map(({ pid }) => pid)
}

async function discoveredRestartWorkerPids(options: RestartWorkerProcessOptions) {
  const activeDataDirectory = path.resolve(
    options.dataDirectory || resolveDataDirectory(options.env),
  )
  const defaultDataDirectory = path.resolve(resolveDataDirectory(options.env))
  if (!options.listProcessesImpl && activeDataDirectory !== defaultDataDirectory) return []
  return restartWorkerPidsFromProcesses(await (options.listProcessesImpl || listProcesses)())
}

/** Hands the quit-wait-launch sequence to a detached, self-deduplicating process. */
export function startBackgroundRestartWorker({
  entryPath,
  spawnImpl = spawn as SpawnImplementation,
  ...options
}: StartRestartWorkerOptions) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  const child = spawnImpl(process.execPath, [entryPath, "restart-worker"], {
    detached: true,
    env: { ...process.env, CODEX_SKIN_HOME: dataDirectory },
    stdio: "ignore",
  })
  child.unref()
  if (!child.pid) throw new Error("Unable to start the Codex restart worker.")
  return child.pid
}

/** Runs at most one restart task and removes legacy or untracked duplicate workers. */
export async function runBackgroundRestartWorker({ task, ...options }: RunRestartWorkerOptions) {
  const paths = runtimePaths(options)
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  const actual = await (options.inspectProcessImpl || inspectProcess)(process.pid)
  if (!actual) throw new Error("Unable to verify the Codex restart worker process.")
  const identity = { ...actual, pid: process.pid }
  if (!(await claimRestartWorkerLock(identity, options))) return false

  try {
    await writeFile(paths.process, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 })
    const duplicates = await discoveredRestartWorkerPids(options)
    await terminateProcesses(duplicates, options)
    await task()
    return true
  } finally {
    const current = await readIdentityFile(paths.process)
    if (current?.pid === process.pid) await rm(paths.process, { force: true })
    await releaseRestartWorkerLock(process.pid, options)
  }
}

/** Stops tracked and orphaned restart workers and removes their runtime state. */
export async function stopBackgroundRestartWorker(options: RestartWorkerProcessOptions = {}) {
  const paths = runtimePaths(options)
  const [tracked, lockOwner, discovered] = await Promise.all([
    readVerifiedIdentity(paths.process, options),
    readVerifiedIdentity(paths.lock, options),
    discoveredRestartWorkerPids(options),
  ])
  const pids = [
    ...discovered,
    ...(tracked ? [tracked.pid] : []),
    ...(lockOwner ? [lockOwner.pid] : []),
  ]
  await terminateProcesses(pids, options)
  await Promise.all([rm(paths.lock, { force: true }), rm(paths.process, { force: true })])
  return tracked?.pid || lockOwner?.pid || pids[0] || null
}
