#!/usr/bin/env node

import { runCli } from "../src/runtime/cli.ts"

try {
  process.exitCode = await runCli(process.argv.slice(2), { entryPath: process.argv[1] })
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`codex-skin: ${message}`)
  process.exitCode = 1
}
