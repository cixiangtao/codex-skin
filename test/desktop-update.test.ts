import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, test, vi } from "vitest"

import {
  compareDesktopReleaseTags,
  createDesktopUpdateController,
  downloadDesktopUpdate,
  parseDesktopReleaseTag,
  selectDesktopUpdateRelease,
} from "../src/desktop/update.ts"

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  )
})

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-update-test-"))
  temporaryDirectories.push(directory)
  return directory
}

function release(tag: string, options: { draft?: boolean; prerelease?: boolean } = {}) {
  return {
    assets: [
      {
        browser_download_url: `https://github.com/cixiangtao/codex-skin/releases/download/${tag}/Codex-Skin-1.1.2-arm64.dmg`,
        name: "Codex-Skin-1.1.2-arm64.dmg",
      },
      {
        browser_download_url: `https://github.com/cixiangtao/codex-skin/releases/download/${tag}/SHA256SUMS.txt`,
        name: "SHA256SUMS.txt",
      },
    ],
    body: "Release notes",
    draft: options.draft || false,
    html_url: `https://github.com/cixiangtao/codex-skin/releases/tag/${tag}`,
    prerelease: options.prerelease || false,
    published_at: "2026-07-30T06:16:00Z",
    tag_name: tag,
  }
}

test("desktop release tags compare preview builds and stable releases", () => {
  assert.deepEqual(parseDesktopReleaseTag("desktop-v1.2.3-preview.4"), {
    major: 1,
    minor: 2,
    patch: 3,
    preview: 4,
  })
  assert.equal(parseDesktopReleaseTag("v1.2.3"), undefined)
  assert.ok(compareDesktopReleaseTags("desktop-v1.2.3-preview.3", "desktop-v1.2.3-preview.2") > 0)
  assert.ok(compareDesktopReleaseTags("desktop-v1.2.3", "desktop-v1.2.3-preview.9") > 0)
  assert.ok(compareDesktopReleaseTags("desktop-v1.3.0-preview.1", "desktop-v1.2.9") > 0)
})

test("selectDesktopUpdateRelease picks the newest preview with verified assets", () => {
  const selected = selectDesktopUpdateRelease(
    [
      release("desktop-v1.1.2-preview.3", { prerelease: true }),
      release("desktop-v1.2.0-preview.1", { prerelease: true }),
      release("desktop-v1.1.2-preview.4", { draft: true, prerelease: true }),
    ],
    "desktop-v1.1.2-preview.2",
  )

  assert.equal(selected?.tag, "desktop-v1.2.0-preview.1")
  assert.equal(selected?.displayVersion, "1.2.0 Preview 1")
})

test("selectDesktopUpdateRelease keeps stable clients off the preview channel", () => {
  const selected = selectDesktopUpdateRelease(
    [release("desktop-v1.2.0-preview.1", { prerelease: true }), release("desktop-v1.1.3")],
    "desktop-v1.1.2",
  )

  assert.equal(selected?.tag, "desktop-v1.1.3")
})

test("downloadDesktopUpdate verifies SHA-256 before exposing the DMG", async () => {
  const downloadsDirectory = await temporaryDirectory()
  const contents = Buffer.from("verified update")
  const checksum = createHash("sha256").update(contents).digest("hex")
  const updateRelease = selectDesktopUpdateRelease(
    [release("desktop-v1.1.2-preview.3", { prerelease: true })],
    "desktop-v1.1.2-preview.2",
  )
  assert.ok(updateRelease)

  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith("SHA256SUMS.txt")) {
      return new Response(`${checksum}  ${updateRelease.dmgAsset.name}\n`)
    }
    return new Response(contents, {
      headers: { "content-length": String(contents.byteLength) },
    })
  })
  const progress: Array<[number, number | null]> = []
  const downloadedPath = await downloadDesktopUpdate(updateRelease, {
    downloadsDirectory,
    fetchImpl: fetchImpl as typeof fetch,
    onProgress: (received, total) => progress.push([received, total]),
  })

  assert.equal(await readFile(downloadedPath, "utf8"), contents.toString())
  assert.deepEqual(progress.at(-1), [contents.byteLength, contents.byteLength])
  assert.deepEqual(await readdir(downloadsDirectory), [updateRelease.dmgAsset.name])
})

test("downloadDesktopUpdate removes a download that fails checksum verification", async () => {
  const downloadsDirectory = await temporaryDirectory()
  const updateRelease = selectDesktopUpdateRelease(
    [release("desktop-v1.1.2-preview.3", { prerelease: true })],
    "desktop-v1.1.2-preview.2",
  )
  assert.ok(updateRelease)

  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith("SHA256SUMS.txt")) {
      return new Response(`${"0".repeat(64)}  ${updateRelease.dmgAsset.name}\n`)
    }
    return new Response("tampered update")
  })

  await assert.rejects(
    downloadDesktopUpdate(updateRelease, {
      downloadsDirectory,
      fetchImpl: fetchImpl as typeof fetch,
    }),
    /failed SHA-256 verification/,
  )
  assert.deepEqual(await readdir(downloadsDirectory), [])
})

test("desktop update controller exposes an available release in its menu state", async () => {
  const dataDirectory = await temporaryDirectory()
  const downloadsDirectory = await temporaryDirectory()
  const dialogs: Array<{ message: string }> = []
  const fetchImpl = vi.fn(async () =>
    Response.json([release("desktop-v1.1.2-preview.3", { prerelease: true })]),
  )
  const controller = createDesktopUpdateController({
    currentTag: "desktop-v1.1.2-preview.2",
    dataDirectory,
    downloadsDirectory,
    fetchImpl: fetchImpl as typeof fetch,
    openPath: async () => "",
    showMessageBox: async (options) => {
      dialogs.push(options)
      return { response: 1 }
    },
  })

  await controller.checkForUpdates({ manual: true })

  assert.deepEqual(controller.getMenuItemState(), {
    enabled: true,
    label: "下载 1.1.2 Preview 3…",
  })
  assert.equal(dialogs[0]?.message, "发现 Codex Skin 1.1.2 Preview 3")
  assert.equal(fetchImpl.mock.calls.length, 1)

  const state = JSON.parse(
    await readFile(path.join(dataDirectory, "desktop-update-state.json"), "utf8"),
  ) as { lastCheckedAtMs: number }
  assert.ok(state.lastCheckedAtMs > 0)
})

test("desktop update controller opens a DMG only after its checksum passes", async () => {
  const dataDirectory = await temporaryDirectory()
  const downloadsDirectory = await temporaryDirectory()
  const contents = Buffer.from("release dmg")
  const checksum = createHash("sha256").update(contents).digest("hex")
  const nextRelease = release("desktop-v1.1.2-preview.3", { prerelease: true })
  const openedPaths: string[] = []
  const progress: number[] = []
  const messages: string[] = []
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.includes("/repos/cixiangtao/codex-skin/releases")) {
      return Response.json([nextRelease])
    }
    if (url.endsWith("SHA256SUMS.txt")) {
      return new Response(`${checksum}  Codex-Skin-1.1.2-arm64.dmg\n`)
    }
    return new Response(contents, {
      headers: { "content-length": String(contents.byteLength) },
    })
  })
  const controller = createDesktopUpdateController({
    currentTag: "desktop-v1.1.2-preview.2",
    dataDirectory,
    downloadsDirectory,
    fetchImpl: fetchImpl as typeof fetch,
    openPath: async (filePath) => {
      openedPaths.push(filePath)
      return ""
    },
    setProgress: (value) => progress.push(value),
    showMessageBox: async (options) => {
      messages.push(options.message)
      return { response: 0 }
    },
  })

  await controller.checkForUpdates({ manual: true })

  assert.equal(openedPaths.length, 1)
  assert.equal(await readFile(openedPaths[0] || "", "utf8"), contents.toString())
  assert.deepEqual(messages, ["发现 Codex Skin 1.1.2 Preview 3", "更新已下载并通过安全校验"])
  assert.equal(progress.at(-1), -1)
})

test("desktop update controller explains why an untagged development build cannot update", async () => {
  const dataDirectory = await temporaryDirectory()
  const downloadsDirectory = await temporaryDirectory()
  const messages: string[] = []
  const controller = createDesktopUpdateController({
    currentTag: "",
    dataDirectory,
    downloadsDirectory,
    openPath: async () => "",
    showMessageBox: async (options) => {
      messages.push(options.message)
      return { response: 0 }
    },
  })

  await controller.checkForUpdates({ manual: true })

  assert.deepEqual(messages, ["当前开发构建无法检查更新"])
})
