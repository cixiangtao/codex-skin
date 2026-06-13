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

test("resolveDataDirectory prefers the skin home and supports the legacy override", () => {
  assert.equal(
    resolveDataDirectory({
      CODEX_BACKGROUND_HOME: "/tmp/legacy-data",
      CODEX_SKIN_HOME: "/tmp/skin-data",
      HOME: "/tmp/home",
    }),
    "/tmp/skin-data",
  )
  assert.equal(
    resolveDataDirectory({ CODEX_BACKGROUND_HOME: "/tmp/legacy-data", HOME: "/tmp/home" }),
    "/tmp/legacy-data",
  )
  assert.equal(
    resolveDataDirectory({ XDG_CONFIG_HOME: "/tmp/xdg", HOME: "/tmp/home" }),
    "/tmp/xdg/codex-skin",
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

  assert.equal(config.surfaces.main.illustrationSize, 1200)
  assert.equal(config.surfaces.main.illustrationX, 0)
  assert.equal(config.surfaces.main.illustrationY, 100)
  assert.equal(config.surfaces.main.illustrationBlur, 30)
  assert.equal(config.surfaces.main.illustrationOpacity, 0)
  assert.equal(config.port, DEFAULT_CONFIG.port)
  assert.equal(config.portMode, "auto")
  assert.equal(config.pollIntervalMs, 500)
})

test("writeConfig persists normalized JSON atomically", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-"))
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
    assert.equal(raw.surfaces.main.illustrationSize, 420)
    assert.equal(raw.surfaces.main.illustrationX, 74)
    assert.equal(raw.surfaces.main.illustrationBlur, 6)
    assert.equal(raw.surfaces.main.illustrationOpacity, 0.65)
    assert.equal(raw.surfaces.sidebar.enabled, false)
    assert.equal(raw.version, 6)
    assert.equal(raw.portMode, "auto")
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("normalizeConfig preserves independent surface settings", () => {
  const config = normalizeConfig({
    version: 4,
    surfaces: {
      main: {
        enabled: true,
        image: "/tmp/main.png",
        illustrationSize: 520,
        illustrationX: 70,
      },
      sidebar: {
        enabled: true,
        image: "/tmp/sidebar.webp",
        illustrationSize: 220,
        illustrationOpacity: 0.18,
      },
    },
  })

  assert.equal(config.surfaces.main.image, "/tmp/main.png")
  assert.equal(config.surfaces.main.illustrationSize, 520)
  assert.equal(config.surfaces.main.illustrationX, 70)
  assert.equal(config.surfaces.sidebar.image, "/tmp/sidebar.webp")
  assert.equal(config.surfaces.sidebar.illustrationSize, 220)
  assert.equal(config.surfaces.sidebar.illustrationOpacity, 0.18)
})

test("normalizeConfig preserves and clamps the global wallpaper", () => {
  const config = normalizeConfig({
    wallpaper: {
      backgroundTransparency: 1.4,
      enabled: true,
      image: "/tmp/wallpaper.png",
      fit: "contain",
      positionX: -10,
      positionY: 140,
    },
  })

  assert.deepEqual(config.wallpaper, {
    backgroundTransparency: 1,
    enabled: true,
    image: "/tmp/wallpaper.png",
    fit: "contain",
    positionX: 0,
    positionY: 100,
  })
})

test("normalizeConfig migrates the v3 background into the main surface", () => {
  const config = normalizeConfig({
    version: 3,
    image: "/tmp/legacy.png",
    illustrationSize: 460,
    illustrationX: 64,
    illustrationOpacity: 0.4,
  })

  assert.equal(config.version, 6)
  assert.deepEqual(config.wallpaper, DEFAULT_CONFIG.wallpaper)
  assert.equal(config.surfaces.main.enabled, true)
  assert.equal(config.surfaces.main.image, "/tmp/legacy.png")
  assert.equal(config.surfaces.main.illustrationSize, 460)
  assert.equal(config.surfaces.main.illustrationX, 64)
  assert.equal(config.surfaces.main.illustrationOpacity, 0.4)
  assert.equal(config.surfaces.sidebar.enabled, false)
  assert.equal(config.surfaces.sidebar.image, null)
})

test("normalizeConfig migrates old default and custom ports", () => {
  assert.equal(normalizeConfig({ version: 2, port: 9229 }).portMode, "auto")
  assert.equal(normalizeConfig({ version: 2, port: 9341 }).portMode, "fixed")
  assert.equal(normalizeConfig({ port: 9341, portMode: "auto" }).portMode, "auto")
})

test("readConfig returns defaults when no file exists", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-"))
  try {
    assert.deepEqual(await readConfig({ dataDirectory }), DEFAULT_CONFIG)
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
