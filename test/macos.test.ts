import assert from "node:assert/strict"

import { test } from "vitest"

import {
  buildLaunchArguments,
  findAvailableCdpPort,
  inspectCdpPort,
  parseProcessTable,
  processDescendsFrom,
  processListContainsExecutable,
  resolveAppExecutable,
  waitForCodexExit,
} from "../src/runtime/macos.ts"

test("waitForCodexExit keeps polling until Codex fully exits", async () => {
  let checks = 0
  await waitForCodexExit("/Applications/ChatGPT.app", {
    isCodexRunningImpl: async () => {
      checks += 1
      return checks < 4
    },
    pollIntervalMs: 0,
  })
  assert.equal(checks, 4)
})

test("resolveAppExecutable targets the signed app executable", () => {
  assert.equal(
    resolveAppExecutable("/Applications/ChatGPT.app"),
    "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
  )
})

test("inspectCdpPort accepts only listeners in the Codex process tree", async () => {
  const executable = resolveAppExecutable("/Applications/ChatGPT.app")
  const processes = parseProcessTable(
    [
      `10 1 ${executable} --remote-debugging-port=9229`,
      "11 10 /Applications/ChatGPT.app/Contents/Frameworks/Codex Helper",
      "20 1 /Applications/Other.app/Other",
    ].join("\n"),
  )
  assert.equal(processDescendsFrom(processes, 11, 10), true)
  assert.equal(processDescendsFrom(processes, 20, 10), false)

  const codex = await inspectCdpPort("/Applications/ChatGPT.app", 9229, {
    listenerPidsImpl: async () => [10, 11],
    processTableImpl: async () => processes,
  })
  assert.equal(codex.state, "codex")

  const occupied = await inspectCdpPort("/Applications/ChatGPT.app", 9229, {
    listenerPidsImpl: async () => [11, 20],
    processTableImpl: async () => processes,
  })
  assert.equal(occupied.state, "occupied")

  const available = await inspectCdpPort("/Applications/ChatGPT.app", 9229, {
    listenerPidsImpl: async () => [],
    processTableImpl: async () => processes,
  })
  assert.equal(available.state, "available")
})

test("findAvailableCdpPort scans forward from a preferred collision", async () => {
  assert.equal(
    await findAvailableCdpPort(9229, {
      listenerPidsImpl: async (port) => (port < 9231 ? [42] : []),
    }),
    9231,
  )
})

test("buildLaunchArguments binds CDP to loopback", () => {
  assert.deepEqual(buildLaunchArguments(9229), [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9229",
  ])
})

test("processListContainsExecutable matches the GUI process without matching helpers", () => {
  const executable = "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT"
  const processList = [
    "/Applications/ChatGPT.app/Contents/Resources/codex app-server",
    executable,
    "/bin/zsh -lc something else",
  ].join("\n")

  assert.equal(processListContainsExecutable(processList, executable), true)
  assert.equal(processListContainsExecutable(processList, "/Applications/Other.app/Other"), false)
})
