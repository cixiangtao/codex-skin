import { spawn } from "node:child_process"
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { isCdpAvailable } from "./cdp.ts"
import { configuredBackgroundImages, readConfig, resolveDataDirectory } from "./config.ts"
import { buildBackgroundCss } from "./css.ts"
import { removeFromAllTargets, TargetSessionManager } from "./injector.ts"
import { findCodexProcessId, inspectCdpPort } from "./macos.ts"
import { inspectProcess, listProcesses } from "./process.ts"
import type { ProcessIdentity, ProcessSummary } from "./process.ts"
import type { DataDirectoryOptions, SpawnImplementation } from "./types.ts"
import { errorCode, errorMessage } from "./types.ts"

interface DaemonIdentity extends ProcessIdentity {
  entryPath: string
  executable: string
  pid: number
}

interface DaemonOptions extends DataDirectoryOptions {
  entryPath?: string
  inspectProcessImpl?: (pid: number) => Promise<ProcessIdentity | null>
  killProcessImpl?: (pid: number, signal: NodeJS.Signals) => void
  listProcessesImpl?: () => Promise<ProcessSummary[]>
}

function runtimePaths(options: DataDirectoryOptions = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return {
    dataDirectory,
    lock: path.join(dataDirectory, "daemon.lock"),
    pid: path.join(dataDirectory, "daemon.pid"),
    process: path.join(dataDirectory, "daemon-process.json"),
    log: path.join(dataDirectory, "daemon.log"),
    state: path.join(dataDirectory, "daemon-state.json"),
  }
}

export function daemonIdentityMatches(identity: DaemonIdentity, actual: ProcessIdentity | null) {
  if (!actual || actual.startedAt !== identity.startedAt) return false
  return (
    actual.command.includes(identity.executable) &&
    actual.command.includes(identity.entryPath) &&
    actual.command.includes("daemon")
  )
}

async function writeDaemonIdentity(identity: DaemonIdentity, options: DataDirectoryOptions = {}) {
  const paths = runtimePaths(options)
  await writeFile(paths.process, `${JSON.stringify(identity, null, 2)}\n`, { mode: 0o600 })
  await writeFile(paths.pid, `${identity.pid}\n`, { mode: 0o600 })
}

/** Matches only direct Codex Skin daemon commands, excluding shells and development servers. */
export function codexSkinDaemonCommandMatches(command: string) {
  const tokens = command.trim().split(/\s+/)
  if (tokens.at(-1) !== "daemon") return false
  const entry = path.basename(tokens.at(-2) || "")
  if (!/^codex-skin(?:\.(?:js|ts))?$/.test(entry)) return false
  if (tokens.length === 2) return true
  if (tokens.length !== 3) return false
  return /^(?:bun|node)$/.test(path.basename(tokens[0] || ""))
}

/** Returns every independently launched Codex Skin daemon except the caller. */
export function daemonPidsFromProcesses(processes: ProcessSummary[], currentPid = process.pid) {
  return processes
    .filter(({ command, pid }) => pid !== currentPid && codexSkinDaemonCommandMatches(command))
    .map(({ pid }) => pid)
}

async function readIdentityFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as DaemonIdentity
  } catch (error) {
    if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

async function readVerifiedIdentity(filePath: string, options: DaemonOptions) {
  const identity = await readIdentityFile(filePath)
  if (!identity) return null
  const actual = await (options.inspectProcessImpl || inspectProcess)(identity.pid)
  return daemonIdentityMatches(identity, actual) ? identity : null
}

function identityMatchesEntry(identity: DaemonIdentity, entryPath: string) {
  return identity.entryPath === path.resolve(entryPath) && identity.executable === process.execPath
}

async function waitForProcessState(
  pid: number,
  options: DaemonOptions,
  expected: "running" | "stopped",
) {
  const inspect = options.inspectProcessImpl || inspectProcess
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const actual = await inspect(pid)
    if ((expected === "running") === Boolean(actual)) return true
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  }
  return false
}

async function waitForDaemonRegistration(pid: number, options: DaemonOptions) {
  const inspect = options.inspectProcessImpl || inspectProcess
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const registeredPid = await readDaemonPid(options)
    if (registeredPid) return registeredPid
    if (!(await inspect(pid))) return null
    await new Promise<void>((resolve) => setTimeout(resolve, 50))
  }
  return null
}

export async function readDaemonPid(options: DaemonOptions = {}) {
  return (await readVerifiedIdentity(runtimePaths(options).process, options))?.pid || null
}

async function claimDaemonLock(identity: DaemonIdentity, options: DaemonOptions) {
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
      const owner = await readVerifiedIdentity(lockPath, options)
      if (owner) return false
      await rm(lockPath, { force: true })
    }
  }
  return false
}

async function releaseDaemonLock(pid: number, options: DaemonOptions) {
  const lockPath = runtimePaths(options).lock
  const owner = await readIdentityFile(lockPath)
  if (owner?.pid === pid) await rm(lockPath, { force: true })
}

async function discoveredDaemonPids(options: DaemonOptions) {
  const activeDataDirectory = path.resolve(
    options.dataDirectory || resolveDataDirectory(options.env),
  )
  const defaultDataDirectory = path.resolve(resolveDataDirectory(options.env))
  if (!options.listProcessesImpl && activeDataDirectory !== defaultDataDirectory) return []
  const processes = await (options.listProcessesImpl || listProcesses)()
  return daemonPidsFromProcesses(processes)
}

async function terminateDaemonPids(pids: number[], options: DaemonOptions) {
  const uniquePids = [...new Set(pids)].filter((pid) => pid !== process.pid)
  const kill = options.killProcessImpl || process.kill
  for (const pid of uniquePids) {
    try {
      kill(pid, "SIGTERM")
    } catch (error) {
      if (errorCode(error) !== "ESRCH") throw error
    }
  }
  const stopped = await Promise.all(
    uniquePids.map((pid) => waitForProcessState(pid, options, "stopped")),
  )
  if (stopped.some((result) => !result)) {
    throw new Error("A previous background daemon did not stop safely.")
  }
}

export async function ensureDaemon({
  entryPath,
  spawnImpl = spawn as SpawnImplementation,
  ...options
}: DaemonOptions & { entryPath: string; spawnImpl?: SpawnImplementation }) {
  const paths = runtimePaths(options)
  const [existing, lockOwner, discovered] = await Promise.all([
    readVerifiedIdentity(paths.process, options),
    readVerifiedIdentity(paths.lock, options),
    discoveredDaemonPids(options),
  ])
  if (existing && lockOwner?.pid === existing.pid && identityMatchesEntry(existing, entryPath)) {
    await terminateDaemonPids(
      discovered.filter((pid) => pid !== existing.pid),
      options,
    )
    return { pid: existing.pid, started: false }
  }
  await terminateDaemonPids(
    [...discovered, ...(existing ? [existing.pid] : []), ...(lockOwner ? [lockOwner.pid] : [])],
    options,
  )
  await Promise.all([
    rm(paths.lock, { force: true }),
    rm(paths.pid, { force: true }),
    rm(paths.process, { force: true }),
    rm(paths.state, { force: true }),
  ])
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  const child = spawnImpl(process.execPath, [entryPath, "daemon"], {
    detached: true,
    env: process.env,
    stdio: "ignore",
  })
  child.unref()
  if (!child.pid) throw new Error("Unable to start the background daemon.")
  const registeredPid = await waitForDaemonRegistration(child.pid, options)
  if (!registeredPid) {
    throw new Error("Unable to verify the background daemon process.")
  }
  return { pid: registeredPid, started: registeredPid === child.pid }
}

export async function stopDaemon(options: DaemonOptions = {}) {
  const paths = runtimePaths(options)
  const [trackedPid, lockOwner, discovered] = await Promise.all([
    readDaemonPid(options),
    readVerifiedIdentity(paths.lock, options),
    discoveredDaemonPids(options),
  ])
  const pids = [
    ...discovered,
    ...(trackedPid ? [trackedPid] : []),
    ...(lockOwner ? [lockOwner.pid] : []),
  ]
  await terminateDaemonPids(pids, options)
  await Promise.all([
    rm(paths.lock, { force: true }),
    rm(paths.pid, { force: true }),
    rm(paths.process, { force: true }),
    rm(paths.state, { force: true }),
  ])
  return trackedPid || pids[0] || null
}

export function codexLifecycleEnded(observedCodex: boolean, codexPid: number | null) {
  return observedCodex && codexPid === null
}

/** Keeps new Codex windows synchronized and exits when the Codex app closes. */
export async function runDaemon(options: DaemonOptions = {}) {
  const paths = runtimePaths(options)
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  const entryPath = path.resolve(options.entryPath || process.argv[1] || "")
  const actual = await (options.inspectProcessImpl || inspectProcess)(process.pid)
  if (!actual) throw new Error("Unable to verify the background daemon process.")
  const identity = { ...actual, entryPath, executable: process.execPath, pid: process.pid }
  if (!(await claimDaemonLock(identity, options))) return
  await writeDaemonIdentity(identity, options)
  let stopping = false
  let observedCodex = false
  const stop = () => {
    stopping = true
  }
  process.once("SIGTERM", stop)
  process.once("SIGINT", stop)
  let cachedConfig = ""
  let cachedCss = ""
  let targetSessions: TargetSessionManager | undefined
  let sessionPort: number | undefined

  try {
    while (!stopping) {
      let pollIntervalMs = 3000
      try {
        const config = await readConfig(options)
        pollIntervalMs = config.pollIntervalMs
        const codexPid = await findCodexProcessId(config.appPath)
        if (codexPid) observedCodex = true
        else if (codexLifecycleEnded(observedCodex, codexPid)) break

        const cdpPort = await inspectCdpPort(config.appPath, config.port)
        const cdpReady = cdpPort.state === "codex" && (await isCdpAvailable({ port: config.port }))
        const hasConfiguredBackground = configuredBackgroundImages(config).length > 0
        if (config.enabled && hasConfiguredBackground && cdpReady) {
          const signature = JSON.stringify(config)
          if (signature !== cachedConfig) {
            cachedCss = await buildBackgroundCss(config)
            cachedConfig = signature
          }
          if (!targetSessions || sessionPort !== config.port) {
            targetSessions?.close()
            sessionPort = config.port
            targetSessions = new TargetSessionManager({
              port: config.port,
              onError: (error) => {
                appendFile(paths.log, `${new Date().toISOString()} ${error.message}\n`, {
                  mode: 0o600,
                }).catch(() => undefined)
              },
            })
          }
          const results = await targetSessions.synchronize(cachedCss)
          const now = new Date().toISOString()
          await writeFile(
            paths.state,
            `${JSON.stringify(
              {
                pid: process.pid,
                codexPid,
                updatedAt: now,
                injectedTargets: results.filter((result) => result.ok).length,
                failedTargets: results.filter((result) => !result.ok).length,
              },
              null,
              2,
            )}\n`,
            { mode: 0o600 },
          )
        } else if (targetSessions) {
          const removalPort = sessionPort || config.port
          targetSessions.close()
          targetSessions = undefined
          sessionPort = undefined
          cachedConfig = ""
          cachedCss = ""
          await removeFromAllTargets({ port: removalPort }).catch(() => undefined)
        }
      } catch (error) {
        await appendFile(paths.log, `${new Date().toISOString()} ${errorMessage(error)}\n`, {
          mode: 0o600,
        })
      }
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  } finally {
    targetSessions?.close()
    const current = await readFile(paths.process, "utf8")
      .then((value) => JSON.parse(value) as DaemonIdentity)
      .catch(() => null)
    if (current?.pid === process.pid) {
      await Promise.all([rm(paths.pid, { force: true }), rm(paths.process, { force: true })])
    }
    await releaseDaemonLock(process.pid, options)
    await rm(paths.state, { force: true })
  }
}
