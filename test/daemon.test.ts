import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import {
  codexSkinDaemonCommandMatches,
  codexLifecycleEnded,
  daemonPidsFromProcesses,
  daemonIdentityMatches,
  ensureDaemon,
} from "../src/runtime/daemon.ts"

test("daemon exits only after an observed Codex process disappears", () => {
  assert.equal(codexLifecycleEnded(false, null), false)
  assert.equal(codexLifecycleEnded(true, 42), false)
  assert.equal(codexLifecycleEnded(true, null), true)
})

test("daemon identity rejects a recycled pid or unrelated command", () => {
  const identity = {
    command: "/opt/node /tmp/codex-skin.js daemon",
    entryPath: "/tmp/codex-skin.js",
    executable: "/opt/node",
    pid: 42,
    startedAt: "Thu Jul 16 14:00:00 2026",
  }
  assert.equal(
    daemonIdentityMatches(identity, {
      command: "/opt/node /tmp/codex-skin.js daemon",
      startedAt: identity.startedAt,
    }),
    true,
  )
  assert.equal(
    daemonIdentityMatches(identity, {
      command: "/opt/node /tmp/codex-skin.js daemon",
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

test("daemon discovery accepts direct package variants but rejects wrappers and other commands", () => {
  assert.equal(
    codexSkinDaemonCommandMatches(`${process.execPath} /tmp/bin/codex-skin.ts daemon`),
    true,
  )
  assert.equal(
    codexSkinDaemonCommandMatches("/opt/bun /tmp/node_modules/.bin/codex-skin daemon"),
    true,
  )
  assert.equal(codexSkinDaemonCommandMatches("/tmp/codex-skin daemon"), true)
  assert.equal(
    codexSkinDaemonCommandMatches("/bin/zsh -lc 'bun /tmp/bin/codex-skin.ts daemon'"),
    false,
  )
  assert.equal(codexSkinDaemonCommandMatches("/opt/bun /tmp/bin/codex-skin.ts dev-server"), false)
  assert.equal(codexSkinDaemonCommandMatches("/opt/node /tmp/unrelated.js daemon"), false)

  assert.deepEqual(
    daemonPidsFromProcesses(
      [
        { pid: 11, command: "/opt/bun /tmp/bin/codex-skin.ts daemon" },
        { pid: 12, command: "/opt/node /tmp/.bin/codex-skin daemon" },
        { pid: 13, command: "/opt/bun /tmp/bin/codex-skin.ts dev-server" },
      ],
      11,
    ),
    [12],
  )
})

test("ensureDaemon keeps the locked current entry and terminates duplicate package daemons", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-daemon-"))
  const entryPath = "/tmp/bin/codex-skin.ts"
  const currentIdentity = {
    command: `${process.execPath} ${entryPath} daemon`,
    entryPath,
    executable: process.execPath,
    pid: 42,
    startedAt: "Thu Jul 16 14:00:00 2026",
  }
  const duplicateCommand = "/opt/node /tmp/node_modules/.bin/codex-skin daemon"
  const alive = new Set([42, 43])
  const killed: number[] = []

  try {
    await Promise.all([
      writeFile(
        path.join(dataDirectory, "daemon-process.json"),
        `${JSON.stringify(currentIdentity)}\n`,
      ),
      writeFile(path.join(dataDirectory, "daemon.lock"), `${JSON.stringify(currentIdentity)}\n`),
    ])

    const result = await ensureDaemon({
      dataDirectory,
      entryPath,
      inspectProcessImpl: async (pid) => {
        if (!alive.has(pid)) return null
        if (pid === 42) return currentIdentity
        return { command: duplicateCommand, startedAt: "Thu Jul 16 13:00:00 2026" }
      },
      killProcessImpl: (pid) => {
        killed.push(pid)
        alive.delete(pid)
      },
      listProcessesImpl: async () => [
        { pid: 42, command: currentIdentity.command },
        { pid: 43, command: duplicateCommand },
      ],
      spawnImpl: () => {
        throw new Error("The current daemon should have been reused.")
      },
    })

    assert.deepEqual(result, { pid: 42, started: false })
    assert.deepEqual(killed, [43])
    assert.deepEqual([...alive], [42])
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
