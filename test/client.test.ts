import assert from "node:assert/strict"

import { test } from "vitest"

import { codexClientPlatform } from "../src/runtime/client.ts"

test("codexClientPlatform isolates platform-specific client operations", () => {
  assert.equal(typeof codexClientPlatform("darwin").isCodexRunning, "function")
  assert.throws(
    () => codexClientPlatform("win32"),
    /Codex client runtime is not implemented for win32/,
  )
})
