import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import { buildBackgroundCss, imageFileToDataUrl } from "../src/runtime/css.ts"

test("imageFileToDataUrl embeds supported images", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-"))
  try {
    const image = path.join(directory, "wallpaper.webp")
    await writeFile(image, Buffer.from([0x52, 0x49, 0x46, 0x46]))
    assert.equal(await imageFileToDataUrl(image), "data:image/webp;base64,UklGRg==")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("imageFileToDataUrl rejects unsupported extensions", async () => {
  await assert.rejects(() => imageFileToDataUrl("/tmp/wallpaper.txt"), /Unsupported image type/)
})

test("buildBackgroundCss adds a small illustration without replacing native surface colors", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-"))
  try {
    const image = path.join(directory, "wallpaper.png")
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const css = await buildBackgroundCss({
      image,
      illustrationSize: 420,
      illustrationX: 78,
      illustrationY: 82,
      illustrationBlur: 8,
      illustrationOpacity: 0.45,
    })

    assert.match(css, /data:image\/png;base64,iVBORw==/)
    assert.match(css, /\.main-surface/)
    assert.match(css, /\.main-surface::before/)
    assert.match(css, /background-size:\s*420px auto/)
    assert.match(css, /background-position:\s*78% 82%/)
    assert.match(css, /filter:\s*blur\(8px\)/)
    assert.match(css, /opacity:\s*0\.45/)
    assert.match(css, /z-index:\s*-1/)
    assert.doesNotMatch(css, /background-color/)
    assert.doesNotMatch(css, /backdrop-filter/)
    assert.doesNotMatch(css, /body::before/)
    assert.doesNotMatch(css, new RegExp(directory.replaceAll("/", "\\/")))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
