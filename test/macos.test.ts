import assert from "node:assert/strict"

import { test } from "vitest"

import {
  buildLaunchArguments,
  findAvailableCdpPort,
  findCodexProcessId,
  inspectCdpPort,
  isCodexRunning,
  parseInstalledApplicationPaths,
  parseProcessTable,
  parseRunningApplicationPids,
  processDescendsFrom,
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

test("resolveAppExecutable reads the executable name from app bundle metadata", async () => {
  assert.equal(
    await resolveAppExecutable("/Applications/Renamed Codex.app", {
      installedAppPathsImpl: async () => [],
      readBundleValueImpl: async (_appPath, key) =>
        key === "CFBundleIdentifier" ? "com.openai.codex" : "Codex Desktop",
    }),
    "/Applications/Renamed Codex.app/Contents/MacOS/Codex Desktop",
  )
})

test("installation lookup normalizes and deduplicates Launch Services paths", () => {
  assert.deepEqual(
    parseInstalledApplicationPaths(
      '["/Applications/ChatGPT.app", "/Applications/ChatGPT.app", null]',
    ),
    ["/Applications/ChatGPT.app"],
  )
})

test("inspectCdpPort accepts only listeners in the Codex process tree", async () => {
  const processes = parseProcessTable(
    [
      "10 1 /Applications/Renamed Codex.app/Contents/MacOS/Codex",
      "11 10 /Applications/Renamed Codex.app/Contents/Frameworks/Codex Helper",
      "20 1 /Applications/Other.app/Other",
    ].join("\n"),
  )
  assert.equal(processDescendsFrom(processes, 11, 10), true)
  assert.equal(processDescendsFrom(processes, 20, 10), false)

  const codex = await inspectCdpPort("/Applications/ChatGPT.app", 9229, {
    listenerPidsImpl: async () => [10, 11],
    processTableImpl: async () => processes,
    runningProcessIdsImpl: async () => [10],
  })
  assert.equal(codex.state, "codex")
  assert.equal(codex.codexPid, 10)

  const occupied = await inspectCdpPort("/Applications/ChatGPT.app", 9229, {
    listenerPidsImpl: async () => [11, 20],
    processTableImpl: async () => processes,
    runningProcessIdsImpl: async () => [10],
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

test("running application lookup uses the native application identity instead of its path", async () => {
  assert.deepEqual(parseRunningApplicationPids("[42, 42, 0, null]"), [42])
  assert.equal(
    await isCodexRunning("/Applications/Renamed Codex.app", {
      runningProcessIdsImpl: async () => [42],
    }),
    true,
  )
  assert.equal(
    await findCodexProcessId("/Applications/Another Name.app", {
      runningProcessIdsImpl: async () => [42],
    }),
    42,
  )
})
