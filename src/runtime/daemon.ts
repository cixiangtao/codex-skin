import { spawn } from "node:child_process"
import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { isCdpAvailable } from "./cdp.ts"
import { readConfig, resolveDataDirectory } from "./config.ts"
import { buildBackgroundCss } from "./css.ts"
import { injectAllTargets } from "./injector.ts"
import { findCodexProcessId } from "./macos.ts"
import type { DataDirectoryOptions, SpawnImplementation } from "./types.ts"
import { errorCode, errorMessage } from "./types.ts"

function runtimePaths(options: DataDirectoryOptions = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return {
    dataDirectory,
    pid: path.join(dataDirectory, "daemon.pid"),
    log: path.join(dataDirectory, "daemon.log"),
    state: path.join(dataDirectory, "daemon-state.json"),
  }
}

function processIsAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export async function readDaemonPid(options: DataDirectoryOptions = {}) {
  const paths = runtimePaths(options)
  try {
    const pid = Number.parseInt(await readFile(paths.pid, "utf8"), 10)
    return processIsAlive(pid) ? pid : null
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null
    throw error
  }
}

export async function ensureDaemon({
  entryPath,
  spawnImpl = spawn as SpawnImplementation,
  ...options
}: DataDirectoryOptions & { entryPath: string; spawnImpl?: SpawnImplementation }) {
  const existingPid = await readDaemonPid(options)
  if (existingPid) return { pid: existingPid, started: false }
  const paths = runtimePaths(options)
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  const child = spawnImpl(process.execPath, [entryPath, "daemon"], {
    detached: true,
    env: process.env,
    stdio: "ignore",
  })
  child.unref()
  if (!child.pid) throw new Error("Unable to start the background daemon.")
  await writeFile(paths.pid, `${child.pid}\n`, { mode: 0o600 })
  return { pid: child.pid, started: true }
}

export async function stopDaemon(options: DataDirectoryOptions = {}) {
  const paths = runtimePaths(options)
  const pid = await readDaemonPid(options)
  if (pid) process.kill(pid, "SIGTERM")
  await rm(paths.pid, { force: true })
  return pid
}

export function codexLifecycleEnded(observedCodex: boolean, codexPid: number | null) {
  return observedCodex && codexPid === null
}

/** Keeps new Codex windows synchronized and exits when the Codex app closes. */
export async function runDaemon(options: DataDirectoryOptions = {}) {
  const paths = runtimePaths(options)
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  await writeFile(paths.pid, `${process.pid}\n`, { mode: 0o600 })
  let stopping = false
  let observedCodex = false
  const stop = () => {
    stopping = true
  }
  process.once("SIGTERM", stop)
  process.once("SIGINT", stop)
  let cachedConfig = ""
  let cachedCss = ""

  try {
    while (!stopping) {
      let pollIntervalMs = 3000
      try {
        const config = await readConfig(options)
        pollIntervalMs = config.pollIntervalMs
        const codexPid = await findCodexProcessId(config.appPath)
        if (codexPid) observedCodex = true
        else if (codexLifecycleEnded(observedCodex, codexPid)) break

        if (config.enabled && config.image && (await isCdpAvailable({ port: config.port }))) {
          const signature = JSON.stringify(config)
          if (signature !== cachedConfig) {
            cachedCss = await buildBackgroundCss(config)
            cachedConfig = signature
          }
          const results = await injectAllTargets({ css: cachedCss, port: config.port })
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
        }
      } catch (error) {
        await appendFile(paths.log, `${new Date().toISOString()} ${errorMessage(error)}\n`, {
          mode: 0o600,
        })
      }
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  } finally {
    const currentPid = await readFile(paths.pid, "utf8").catch(() => "")
    if (Number.parseInt(currentPid, 10) === process.pid) await rm(paths.pid, { force: true })
    await rm(paths.state, { force: true })
  }
}
