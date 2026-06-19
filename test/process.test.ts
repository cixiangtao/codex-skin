import assert from "node:assert/strict"

import { test } from "vitest"

import { parseProcessList } from "../src/runtime/process.ts"

test("parseProcessList preserves commands and ignores malformed rows", () => {
  assert.deepEqual(
    parseProcessList(`
  42 /opt/bun /tmp/bin/codex-skin.ts daemon
not-a-process
  77 /Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-port=9229

`),
    [
      { pid: 42, command: "/opt/bun /tmp/bin/codex-skin.ts daemon" },
      {
        pid: 77,
        command: "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT --remote-debugging-port=9229",
      },
    ],
  )
})
