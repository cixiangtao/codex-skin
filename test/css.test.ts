import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import { buildBackgroundCss, imageFileToDataUrl } from "../src/runtime/css.ts"

test("imageFileToDataUrl embeds supported images", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-"))
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
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-"))
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
    assert.match(css, /\.app-shell-main-content-viewport/)
    assert.match(css, /\.app-shell-main-content-viewport::before/)
    assert.match(css, /background-size:\s*420px auto/)
    assert.match(css, /background-position:\s*right 22% bottom 18%/)
    assert.match(css, /filter:\s*blur\(8px\)/)
    assert.match(css, /opacity:\s*0\.45/)
    assert.match(css, /z-index:\s*-1/)
    assert.match(css, /inset:\s*0/)
    assert.doesNotMatch(css, /background-position:[^;]*px/)
    assert.doesNotMatch(css, /codex-skin-main-safe/)
    assert.doesNotMatch(css, /background-color/)
    assert.doesNotMatch(css, /backdrop-filter/)
    assert.doesNotMatch(css, /body::before/)
    assert.doesNotMatch(css, new RegExp(directory.replaceAll("/", "\\/")))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("buildBackgroundCss creates independent main and sidebar layers", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-"))
  try {
    const mainImage = path.join(directory, "main.png")
    const sidebarImage = path.join(directory, "sidebar.webp")
    await writeFile(mainImage, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeFile(sidebarImage, Buffer.from([0x52, 0x49, 0x46, 0x46]))
    const css = await buildBackgroundCss({
      surfaces: {
        main: {
          enabled: true,
          image: mainImage,
          illustrationSize: 500,
          illustrationX: 75,
        },
        sidebar: {
          enabled: true,
          image: sidebarImage,
          illustrationSize: 220,
          illustrationOpacity: 0.2,
        },
      },
    })

    assert.match(css, /\.app-shell-main-content-viewport::before/)
    assert.match(css, /\.app-shell-left-panel::before/)
    assert.match(css, /background-size:\s*500px auto/)
    assert.match(css, /background-size:\s*220px auto/)
    assert.match(css, /clip-path:\s*inset\(0\)/)
    assert.match(css, /\.app-shell-left-panel::before[\s\S]*?inset:\s*0;/)
    assert.match(css, /image\/png;base64,iVBORw==/)
    assert.match(css, /image\/webp;base64,UklGRg==/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
