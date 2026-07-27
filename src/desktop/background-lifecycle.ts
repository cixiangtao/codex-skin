import type { BackgroundLifecycleAdapter } from "../core/index.ts"
import { runBackgroundMonitor } from "../runtime/background-monitor.ts"
import type { BackgroundMonitorOptions } from "../runtime/background-monitor.ts"
import { stopDaemon } from "../runtime/daemon.ts"

interface DesktopBackgroundLifecycleOptions {
  dataDirectory: string
  onError?: (error: unknown) => void
  runMonitorImpl?: (options: BackgroundMonitorOptions) => Promise<void>
  stopDaemonImpl?: (options: { dataDirectory: string }) => Promise<number | null>
}

/** Owns the renderer monitor inside a long-running desktop application process. */
export function createDesktopBackgroundLifecycle(
  options: DesktopBackgroundLifecycleOptions,
): BackgroundLifecycleAdapter {
  let controller: AbortController | undefined
  let monitorTask: Promise<void> | undefined

  return {
    isRunning: async () => monitorTask !== undefined,
    start: async () => {
      if (monitorTask) return { owner: "desktop", pid: process.pid, started: false }

      await (options.stopDaemonImpl || stopDaemon)({ dataDirectory: options.dataDirectory })
      controller = new AbortController()
      const activeController = controller
      const runMonitor = options.runMonitorImpl || runBackgroundMonitor
      const task = runMonitor({
        dataDirectory: options.dataDirectory,
        exitWhenCodexCloses: false,
        signal: activeController.signal,
      })
        .catch((error) => {
          options.onError?.(error)
        })
        .finally(() => {
          if (monitorTask === task) {
            controller = undefined
            monitorTask = undefined
          }
        })
      monitorTask = task
      return { owner: "desktop", pid: process.pid, started: true }
    },
    stop: async () => {
      const activeTask = monitorTask
      const wasRunning = Boolean(activeTask)
      controller?.abort()
      const [daemonPid] = await Promise.all([
        (options.stopDaemonImpl || stopDaemon)({ dataDirectory: options.dataDirectory }),
        activeTask,
      ])
      return wasRunning ? process.pid : daemonPid
    },
  }
}
