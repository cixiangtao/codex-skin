import { execFile, spawn } from "node:child_process"
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { isCdpAvailable } from "./cdp.ts"
import { configuredBackgroundSurfaces, readConfig, resolveDataDirectory } from "./config.ts"
import { buildBackgroundCss } from "./css.ts"
import { removeFromAllTargets, TargetSessionManager } from "./injector.ts"
import { findCodexProcessId, inspectCdpPort } from "./macos.ts"
import type { DataDirectoryOptions, SpawnImplementation } from "./types.ts"
import { errorCode, errorMessage } from "./types.ts"

const execFileAsync = promisify(execFile)

interface ProcessIdentity {
  command: string
  startedAt: string
}

interface DaemonIdentity extends ProcessIdentity {
  entryPath: string
  executable: string
  pid: number
}

interface DaemonOptions extends DataDirectoryOptions {
  entryPath?: string
  inspectProcessImpl?: (pid: number) => Promise<ProcessIdentity | null>
}

function runtimePaths(options: DataDirectoryOptions = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return {
    dataDirectory,
    pid: path.join(dataDirectory, "daemon.pid"),
    process: path.join(dataDirectory, "daemon-process.json"),
    log: path.join(dataDirectory, "daemon.log"),
    state: path.join(dataDirectory, "daemon-state.json"),
  }
}

async function inspectProcess(pid: number): Promise<ProcessIdentity | null> {
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

export function legacyDaemonCommandMatches(command: string, entryPath: string) {
  const resolvedEntryPath = path.resolve(entryPath)
  const entrySuffix = resolvedEntryPath.endsWith(".ts")
    ? `/bin/${path.basename(resolvedEntryPath)}`
    : `/dist/bin/${path.basename(resolvedEntryPath)}`
  return (
    command.includes(process.execPath) &&
    (command.includes(resolvedEntryPath) || command.includes(entrySuffix)) &&
    /(?:^|\s)daemon(?:\s|$)/.test(command)
  )
}

async function readVerifiedLegacyDaemonPid(entryPath: string, options: DaemonOptions) {
  try {
    const pid = Number.parseInt(await readFile(runtimePaths(options).pid, "utf8"), 10)
    const actual = await (options.inspectProcessImpl || inspectProcess)(pid)
    return actual && legacyDaemonCommandMatches(actual.command, entryPath) ? pid : null
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null
    throw error
  }
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

export async function readDaemonPid(options: DaemonOptions = {}) {
  const paths = runtimePaths(options)
  try {
    const identity = JSON.parse(await readFile(paths.process, "utf8")) as DaemonIdentity
    const actual = await (options.inspectProcessImpl || inspectProcess)(identity.pid)
    return daemonIdentityMatches(identity, actual) ? identity.pid : null
  } catch (error) {
    if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

export async function ensureDaemon({
  entryPath,
  spawnImpl = spawn as SpawnImplementation,
  ...options
}: DaemonOptions & { entryPath: string; spawnImpl?: SpawnImplementation }) {
  const existingPid = await readDaemonPid(options)
  if (existingPid) return { pid: existingPid, started: false }
  const paths = runtimePaths(options)
  const legacyPid = await readVerifiedLegacyDaemonPid(entryPath, options)
  if (legacyPid) {
    process.kill(legacyPid, "SIGTERM")
    if (!(await waitForProcessState(legacyPid, options, "stopped"))) {
      throw new Error("The previous background daemon did not stop safely.")
    }
  }
  await Promise.all([rm(paths.pid, { force: true }), rm(paths.process, { force: true })])
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  const child = spawnImpl(process.execPath, [entryPath, "daemon"], {
    detached: true,
    env: process.env,
    stdio: "ignore",
  })
  child.unref()
  if (!child.pid) throw new Error("Unable to start the background daemon.")
  if (!(await waitForProcessState(child.pid, options, "running"))) {
    throw new Error("Unable to verify the background daemon process.")
  }
  const actual = await (options.inspectProcessImpl || inspectProcess)(child.pid)
  if (!actual) throw new Error("Unable to verify the background daemon process.")
  await writeDaemonIdentity(
    {
      ...actual,
      entryPath: path.resolve(entryPath),
      executable: process.execPath,
      pid: child.pid,
    },
    options,
  )
  return { pid: child.pid, started: true }
}

export async function stopDaemon(options: DaemonOptions = {}) {
  const paths = runtimePaths(options)
  const pid = await readDaemonPid(options)
  if (pid) process.kill(pid, "SIGTERM")
  await Promise.all([rm(paths.pid, { force: true }), rm(paths.process, { force: true })])
  return pid
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
  await writeDaemonIdentity(
    { ...actual, entryPath, executable: process.execPath, pid: process.pid },
    options,
  )
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
        const hasConfiguredBackground = configuredBackgroundSurfaces(config).length > 0
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
    await rm(paths.state, { force: true })
  }
}
