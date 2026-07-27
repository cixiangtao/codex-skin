import assert from "node:assert/strict"

import { test } from "vitest"

import { createDesktopBackgroundLifecycle } from "../src/desktop/background-lifecycle.ts"

test("desktop lifecycle reuses one monitor and stops it through AbortSignal", async () => {
  let monitorStarts = 0
  let stopDaemonCalls = 0
  let receivedSignal: AbortSignal | undefined
  const lifecycle = createDesktopBackgroundLifecycle({
    dataDirectory: "/tmp/codex-skin-desktop-test",
    runMonitorImpl: async ({ signal }) => {
      monitorStarts += 1
      receivedSignal = signal
      await new Promise<void>((resolve) => signal?.addEventListener("abort", () => resolve()))
    },
    stopDaemonImpl: async () => {
      stopDaemonCalls += 1
      return null
    },
  })

  assert.deepEqual(await lifecycle.start(), {
    owner: "desktop",
    pid: process.pid,
    started: true,
  })
  assert.deepEqual(await lifecycle.start(), {
    owner: "desktop",
    pid: process.pid,
    started: false,
  })
  assert.equal(await lifecycle.isRunning?.(), true)
  assert.equal(monitorStarts, 1)
  assert.equal(stopDaemonCalls, 1)

  assert.equal(await lifecycle.stop(), process.pid)
  assert.equal(receivedSignal?.aborted, true)
  assert.equal(await lifecycle.isRunning?.(), false)
  assert.equal(stopDaemonCalls, 2)
})
