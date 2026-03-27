import assert from "node:assert/strict"

import { test } from "vitest"

import {
  codexLifecycleEnded,
  daemonIdentityMatches,
  legacyDaemonCommandMatches,
} from "../src/runtime/daemon.ts"

test("daemon exits only after an observed Codex process disappears", () => {
  assert.equal(codexLifecycleEnded(false, null), false)
  assert.equal(codexLifecycleEnded(true, 42), false)
  assert.equal(codexLifecycleEnded(true, null), true)
})

test("daemon identity rejects a recycled pid or unrelated command", () => {
  const identity = {
    command: "/opt/node /tmp/codex-background.js daemon",
    entryPath: "/tmp/codex-background.js",
    executable: "/opt/node",
    pid: 42,
    startedAt: "Thu Jul 16 14:00:00 2026",
  }
  assert.equal(
    daemonIdentityMatches(identity, {
      command: "/opt/node /tmp/codex-background.js daemon",
      startedAt: identity.startedAt,
    }),
    true,
  )
  assert.equal(
    daemonIdentityMatches(identity, {
      command: "/opt/node /tmp/codex-background.js daemon",
      startedAt: "Thu Jul 16 15:00:00 2026",
    }),
    false,
  )
  assert.equal(
    daemonIdentityMatches(identity, {
      command: "/opt/node /tmp/unrelated.js daemon",
      startedAt: identity.startedAt,
    }),
    false,
  )
})

test("legacy daemon migration accepts only the exact executable and entry path", () => {
  const entryPath = "/tmp/codex-background.js"
  assert.equal(
    legacyDaemonCommandMatches(`${process.execPath} ${entryPath} daemon`, entryPath),
    true,
  )
  assert.equal(
    legacyDaemonCommandMatches(
      `${process.execPath} /tmp/old-package/dist/bin/codex-background.js daemon`,
      entryPath,
    ),
    true,
  )
  assert.equal(
    legacyDaemonCommandMatches(`${process.execPath} /tmp/unrelated.js daemon`, entryPath),
    false,
  )
  assert.equal(legacyDaemonCommandMatches(`/opt/other ${entryPath} daemon`, entryPath), false)
})
