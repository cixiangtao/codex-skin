import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import {
  DEFAULT_CONFIG,
  normalizeConfig,
  readConfig,
  resolveDataDirectory,
  writeConfig,
} from "../src/runtime/config.ts"

test("resolveDataDirectory prefers the explicit background home", () => {
  assert.equal(
    resolveDataDirectory({ CODEX_BACKGROUND_HOME: "/tmp/background-data", HOME: "/tmp/home" }),
    "/tmp/background-data",
  )
})

test("normalizeConfig clamps unsafe numeric values", () => {
  const config = normalizeConfig({
    illustrationSize: 5000,
    illustrationX: -20,
    illustrationY: 140,
    illustrationBlur: 99,
    illustrationOpacity: -1,
    port: 80,
    pollIntervalMs: 100,
  })

  assert.equal(config.illustrationSize, 1200)
  assert.equal(config.illustrationX, 0)
  assert.equal(config.illustrationY, 100)
  assert.equal(config.illustrationBlur, 30)
  assert.equal(config.illustrationOpacity, 0)
  assert.equal(config.port, DEFAULT_CONFIG.port)
  assert.equal(config.pollIntervalMs, 500)
})

test("writeConfig persists normalized JSON atomically", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-background-"))
  try {
    const written = await writeConfig(
      {
        image: "/tmp/character.webp",
        illustrationSize: 420,
        illustrationX: 74,
        illustrationBlur: 6,
        illustrationOpacity: 0.65,
      },
      { dataDirectory },
    )
    const loaded = await readConfig({ dataDirectory })
    const raw = JSON.parse(await readFile(path.join(dataDirectory, "config.json"), "utf8"))

    assert.deepEqual(loaded, written)
    assert.equal(raw.illustrationSize, 420)
    assert.equal(raw.illustrationX, 74)
    assert.equal(raw.illustrationBlur, 6)
    assert.equal(raw.illustrationOpacity, 0.65)
    assert.equal(raw.version, 2)
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("readConfig returns defaults when no file exists", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-background-"))
  try {
    assert.deepEqual(await readConfig({ dataDirectory }), DEFAULT_CONFIG)
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
