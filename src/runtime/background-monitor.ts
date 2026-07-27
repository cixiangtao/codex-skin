import { appendFile, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import { isCdpAvailable } from "./cdp.ts"
import { findCodexProcessId, inspectCdpPort } from "./client.ts"
import { configuredBackgroundImages, readConfig, resolveDataDirectory } from "./config.ts"
import { buildBackgroundCss } from "./css.ts"
import { removeFromAllTargets, TargetSessionManager } from "./injector.ts"
import type { DataDirectoryOptions } from "./types.ts"
import { errorMessage } from "./types.ts"

export interface BackgroundMonitorOptions extends DataDirectoryOptions {
  /** Stops a detached CLI monitor after Codex closes. Client-owned monitors stay resident. */
  exitWhenCodexCloses?: boolean
  /** Allows the owning process to stop the monitor without process-level signals. */
  signal?: AbortSignal
}

function monitorPaths(options: DataDirectoryOptions) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return {
    dataDirectory,
    log: path.join(dataDirectory, "daemon.log"),
    state: path.join(dataDirectory, "daemon-state.json"),
  }
}

function waitForNextPoll(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, delayMs)
    function finish() {
      signal?.removeEventListener("abort", finish)
      clearTimeout(timer)
      resolve()
    }
    signal?.addEventListener("abort", finish, { once: true })
  })
}

/**
 * Keeps new Codex renderer targets synchronized without owning the host process lifecycle.
 *
 * Detached CLI daemons and in-process desktop clients supply different stop behavior while
 * sharing this same renderer synchronization loop.
 */
export async function runBackgroundMonitor(options: BackgroundMonitorOptions = {}) {
  const paths = monitorPaths(options)
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 })
  let observedCodex = false
  let cachedConfig = ""
  let cachedCss = ""
  let targetSessions: TargetSessionManager | undefined
  let sessionPort: number | undefined

  try {
    while (!options.signal?.aborted) {
      let pollIntervalMs = 3000
      try {
        const config = await readConfig(options)
        pollIntervalMs = config.pollIntervalMs
        const codexPid = await findCodexProcessId(config.appPath)
        if (codexPid) observedCodex = true
        else if (options.exitWhenCodexCloses && codexLifecycleEnded(observedCodex, codexPid)) {
          break
        }

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
          await writeFile(
            paths.state,
            `${JSON.stringify(
              {
                pid: process.pid,
                codexPid,
                updatedAt: new Date().toISOString(),
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
      await waitForNextPoll(pollIntervalMs, options.signal)
    }
  } finally {
    targetSessions?.close()
    await rm(paths.state, { force: true })
  }
}

export function codexLifecycleEnded(observedCodex: boolean, codexPid: number | null) {
  return observedCodex && codexPid === null
}
