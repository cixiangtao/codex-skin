import assert from "node:assert/strict"

import { test } from "vitest"

import { createCodexSkinCore, normalizeConfig } from "../src/core/index.ts"

test("core starts through a client-owned lifecycle without a CLI entry path", async () => {
  const events: string[] = []
  const core = createCodexSkinCore({
    appExecutableExistsImpl: async () => true,
    backgroundLifecycle: {
      start: async () => {
        events.push("start-lifecycle")
        return { owner: "desktop", pid: 42 }
      },
      stop: async () => {
        events.push("stop-lifecycle")
        return 42
      },
    },
    isCdpAvailableImpl: async () => true,
    isCodexRunningImpl: async () => true,
  })

  const result = await core.start(normalizeConfig({ enabled: false }))

  assert.deepEqual(events, ["start-lifecycle"])
  assert.deepEqual(result.daemon, { owner: "desktop", pid: 42 })
  assert.equal(result.mode, "started")
  assert.equal(result.targets, 0)
})

test("core synchronizes shutdown through the injected lifecycle", async () => {
  const events: string[] = []
  const core = createCodexSkinCore({
    backgroundLifecycle: {
      start: async () => ({ pid: 42 }),
      stop: async () => {
        events.push("stop-lifecycle")
        return 42
      },
    },
    isCdpAvailableImpl: async () => false,
    removeFromAllTargetsImpl: async () => {
      events.push("remove")
      return 1
    },
  })

  const result = await core.sync(normalizeConfig({ enabled: false }))

  assert.deepEqual(events, ["stop-lifecycle"])
  assert.deepEqual(result, { applied: true, mode: "removed", pid: 42, targets: 0 })
})
