import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import pc from "picocolors"
import { test } from "vitest"

import {
  formatRuntimeSummary,
  isSupportedNodeVersion,
  parseArguments,
  runCli,
  verificationChecks,
} from "../src/runtime/cli.ts"
import { writeConfig } from "../src/runtime/config.ts"

test("formatRuntimeSummary shows version, ports, processes, and the stop command", () => {
  const summary = formatRuntimeSummary(
    {
      cdpPort: 9229,
      daemonPid: 456,
      settingsPid: 123,
      settingsPort: 4179,
    },
    { colors: pc.createColors(false), version: "1.2.3-beta.4" },
  )

  assert.equal(
    summary,
    [
      "Codex Skin v1.2.3-beta.4",
      "",
      "  Settings   running · PID 123 · http://127.0.0.1:4179/",
      "  Background running · PID 456",
      "  Codex CDP  127.0.0.1:9229",
      "  Stop       npx codex-skin stop",
    ].join("\n"),
  )
})

test("formatRuntimeSummary uses terminal colors and explains a pending background", () => {
  const summary = formatRuntimeSummary(
    {
      cdpPort: 9229,
      daemonPid: null,
      settingsPid: 123,
      settingsPort: 4179,
    },
    { colors: pc.createColors(true), version: "1.2.3" },
  )

  assert.equal(summary.includes(`${String.fromCodePoint(27)}[`), true)
  assert.match(summary, /waiting to start/)
  assert.match(summary, /npx codex-skin stop/)
})

test("parseArguments reads configure options without evaluating shell text", () => {
  assert.deepEqual(
    parseArguments([
      "configure",
      "--image",
      "/tmp/a $(touch nope).webp",
      "--illustration-size",
      "420",
      "--x",
      "76",
      "--blur",
      "7",
      "--opacity",
      "0.7",
    ]),
    {
      command: "configure",
      options: {
        image: "/tmp/a $(touch nope).webp",
        illustrationSize: "420",
        illustrationX: "76",
        illustrationBlur: "7",
        illustrationOpacity: "0.7",
      },
    },
  )
})

test("parseArguments rejects unknown flags", () => {
  assert.throws(() => parseArguments(["configure", "--wat", "1"]), /Unknown option/)
})

test("parseArguments accepts the visual settings command", () => {
  assert.deepEqual(parseArguments(["settings"]), { command: "settings", options: {} })
})

test("parseArguments accepts reload verification", () => {
  assert.deepEqual(parseArguments(["verify", "--reload"]), {
    command: "verify",
    options: { reload: true },
  })
})

test("parseArguments accepts automatic port selection", () => {
  assert.deepEqual(parseArguments(["configure", "--auto-port"]), {
    command: "configure",
    options: { autoPort: true },
  })
})

test("parseArguments targets independent sidebar settings", () => {
  assert.deepEqual(
    parseArguments([
      "configure",
      "--surface",
      "sidebar",
      "--image",
      "/tmp/sidebar.png",
      "--enable-surface",
    ]),
    {
      command: "configure",
      options: {
        surface: "sidebar",
        image: "/tmp/sidebar.png",
        surfaceEnabled: true,
      },
    },
  )
})

test("verificationChecks explains each visible failure", () => {
  assert.deepEqual(
    verificationChecks({
      backgroundImage: "none",
      enabled: true,
      hashMatches: false,
      href: "app://-/index.html",
      pass: false,
      pointerEvents: "auto",
      stylePresent: true,
      surfacePresent: false,
    }),
    [
      ["injection marker enabled", true],
      ["background style present", true],
      ["configuration hash matches", false],
      ["workspace surface found", false],
      ["pseudo-element background image active", false],
      ["decorative layer ignores pointer events", false],
    ],
  )
})

test("parseArguments launches the complete experience by default", () => {
  assert.deepEqual(parseArguments([]), { command: "launch", options: {} })
})

test("isSupportedNodeVersion enforces the published runtime baseline", () => {
  assert.equal(isSupportedNodeVersion("21.7.3"), false)
  assert.equal(isSupportedNodeVersion("22.0.0"), true)
  assert.equal(isSupportedNodeVersion("24.18.0"), true)
})

test("launch continues with the all-disabled first-run config", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-cli-initial-"))
  const previousHome = process.env.CODEX_SKIN_HOME
  process.env.CODEX_SKIN_HOME = dataDirectory
  const events: string[] = []

  try {
    const exitCode = await runCli([], {
      colors: pc.createColors(false),
      entryPath: "/tmp/codex-skin.js",
      io: { log: (message) => events.push(message) },
      isCodexRunningImpl: async () => false,
      openSettingsImpl: async () => {
        events.push("settings")
        return { pid: 12, port: 4179, url: "http://127.0.0.1:4179/" } as never
      },
      startConfiguredBackgroundImpl: async (config) => {
        events.push("start")
        assert.equal(config.enabled, false)
        assert.equal(config.wallpaper.enabled, false)
        assert.equal(config.surfaces.main.enabled, false)
        assert.equal(config.surfaces.sidebar.enabled, false)
        return {
          applied: true,
          daemon: { pid: 91 },
          mode: "started",
          port: config.port,
          targets: 0,
        }
      },
      version: "1.2.3",
    })

    assert.equal(exitCode, 0)
    assert.deepEqual(events.slice(0, 2), ["settings", "start"])
    assert.match(events[2] || "", /Background running · PID 91/)
    assert.equal(events[3], "Applied the background to 0 Codex windows.")
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_SKIN_HOME
    else process.env.CODEX_SKIN_HOME = previousHome
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("launch prints service status before handing a running Codex restart to a worker", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-cli-"))
  const image = path.join(dataDirectory, "wallpaper.jpg")
  const previousHome = process.env.CODEX_SKIN_HOME
  process.env.CODEX_SKIN_HOME = dataDirectory
  await writeFile(image, Buffer.from([0xff, 0xd8, 0xff]))
  await writeConfig({ image })
  const events: string[] = []

  try {
    const exitCode = await runCli([], {
      colors: pc.createColors(false),
      configuredCdpIsReadyImpl: async () => ({
        httpReady: false,
        inspection: { codexPid: null, listenerPids: [], state: "available" },
      }),
      confirmCodexRestartImpl: async () => {
        events.push("confirm")
        return true
      },
      entryPath: "/tmp/codex-skin.js",
      io: { log: (message) => events.push(message) },
      isCodexRunningImpl: async () => true,
      openSettingsImpl: async () => {
        events.push("settings")
        return { pid: 12, port: 4179, url: "http://127.0.0.1:4179/" } as never
      },
      startBackgroundRestartWorkerImpl: ({ entryPath }) => {
        events.push(`worker:${entryPath}`)
        return 87
      },
      startConfiguredBackgroundImpl: async () => {
        throw new Error("the interactive CLI must not own the restart lifecycle")
      },
      version: "1.2.3",
    })

    assert.equal(exitCode, 0)
    assert.equal(events[0], "confirm")
    assert.match(events[1] || "", /Waiting for Codex to quit/)
    assert.equal(events[2], "settings")
    assert.match(events[3] || "", /Codex Skin v1\.2\.3/)
    assert.match(events[3] || "", /Settings\s+running · PID 12 · http:\/\/127\.0\.0\.1:4179\//)
    assert.match(events[4] || "", /Codex restart scheduled/)
    assert.equal(events[5], "worker:/tmp/codex-skin.js")
  } finally {
    if (previousHome === undefined) delete process.env.CODEX_SKIN_HOME
    else process.env.CODEX_SKIN_HOME = previousHome
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
