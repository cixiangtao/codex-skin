import assert from "node:assert/strict"
import { access, mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import {
  restartWorkerPidsFromProcesses,
  runBackgroundRestartWorker,
  stopBackgroundRestartWorker,
} from "../src/runtime/restart-worker.ts"

test("restart worker discovery excludes other Codex Skin commands", () => {
  assert.deepEqual(
    restartWorkerPidsFromProcesses(
      [
        { pid: 11, command: "/opt/bun /tmp/bin/codex-skin.ts restart-worker" },
        { pid: 12, command: "/opt/node /tmp/.bin/codex-skin restart-worker" },
        { pid: 13, command: "/opt/bun /tmp/bin/codex-skin.ts daemon" },
      ],
      11,
    ),
    [12],
  )
})

test("runBackgroundRestartWorker terminates orphan siblings before running the task", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-restart-worker-"))
  const currentIdentity = {
    command: `${process.execPath} /tmp/codex-skin.js restart-worker`,
    startedAt: "Mon Jul 16 09:00:00 2026",
  }
  const orphanIdentity = {
    command: "/opt/node /tmp/other/codex-skin restart-worker",
    startedAt: "Mon Jul 16 08:59:00 2026",
  }
  const alive = new Set([process.pid, 43])
  const events: string[] = []

  try {
    assert.equal(
      await runBackgroundRestartWorker({
        dataDirectory,
        inspectProcessImpl: async (pid) => {
          if (!alive.has(pid)) return null
          return pid === process.pid ? currentIdentity : orphanIdentity
        },
        killProcessImpl: (pid) => {
          events.push(`kill:${pid}`)
          alive.delete(pid)
        },
        listProcessesImpl: async () => [
          { pid: process.pid, command: currentIdentity.command },
          { pid: 43, command: orphanIdentity.command },
        ],
        task: async () => {
          events.push("task")
        },
      }),
      true,
    )
    assert.deepEqual(events, ["kill:43", "task"])
    await assert.rejects(() => access(path.join(dataDirectory, "restart-worker.lock")), {
      code: "ENOENT",
    })
    await assert.rejects(() => access(path.join(dataDirectory, "restart-worker.json")), {
      code: "ENOENT",
    })
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("stopBackgroundRestartWorker terminates an untracked orphan", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-restart-stop-"))
  const identity = {
    command: "/opt/node /tmp/codex-skin restart-worker",
    startedAt: "Mon Jul 16 09:00:00 2026",
  }
  let alive = true

  try {
    assert.equal(
      await stopBackgroundRestartWorker({
        dataDirectory,
        inspectProcessImpl: async () => (alive ? identity : null),
        killProcessImpl: () => {
          alive = false
        },
        listProcessesImpl: async () => [{ pid: 51, command: identity.command }],
      }),
      51,
    )
    assert.equal(alive, false)
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
