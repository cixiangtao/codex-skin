import assert from "node:assert/strict"

import pc from "picocolors"
import { test } from "vitest"

import {
  formatRuntimeSummary,
  isSupportedNodeVersion,
  parseArguments,
  verificationChecks,
} from "../src/runtime/cli.ts"

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
      "  Settings   running · PID 123 · 127.0.0.1:4179",
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
