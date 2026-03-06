import assert from "node:assert/strict"

import { test } from "vitest"

import { parseArguments } from "../src/runtime/cli.ts"

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

test("parseArguments launches the complete experience by default", () => {
  assert.deepEqual(parseArguments([]), { command: "launch", options: {} })
})
