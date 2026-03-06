import assert from "node:assert/strict"

import { test } from "vitest"

import { codexLifecycleEnded } from "../src/runtime/daemon.ts"

test("daemon exits only after an observed Codex process disappears", () => {
  assert.equal(codexLifecycleEnded(false, null), false)
  assert.equal(codexLifecycleEnded(true, 42), false)
  assert.equal(codexLifecycleEnded(true, null), true)
})
