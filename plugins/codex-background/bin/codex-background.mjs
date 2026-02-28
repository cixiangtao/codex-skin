#!/usr/bin/env node

import { runCli } from "../src/cli.mjs";

try {
  process.exitCode = await runCli(process.argv.slice(2), { entryPath: process.argv[1] });
} catch (error) {
  console.error(`codex-background: ${error.message}`);
  process.exitCode = 1;
}
