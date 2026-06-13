import assert from "node:assert/strict"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import { readConfig, writeConfig } from "../src/runtime/config.ts"
import {
  listenSettingsServer,
  settingsServerIdentityMatches,
  stopSettingsServer,
} from "../src/runtime/settings-server.ts"

test("settings server identity rejects a recycled pid", () => {
  const state = {
    pid: 42,
    port: 4179,
    process: {
      command: "/opt/node /tmp/codex-skin.js settings-server",
      startedAt: "Mon Jul 16 09:00:00 2026",
    },
    startedAt: "2026-07-16T01:00:00.000Z",
    token: "test-token",
  }

  assert.equal(settingsServerIdentityMatches(state, state.process), true)
  assert.equal(
    settingsServerIdentityMatches(state, {
      ...state.process,
      startedAt: "Mon Jul 16 10:00:00 2026",
    }),
    false,
  )
  assert.equal(
    settingsServerIdentityMatches(state, {
      command: "/opt/node /tmp/unrelated.js settings-server",
      startedAt: state.process.startedAt,
    }),
    false,
  )
})

test("settings server identity accepts the npm bin shim command", () => {
  const processIdentity = {
    command: "/opt/node /Users/test/.npm/_npx/cache/node_modules/.bin/codex-skin settings-server",
    startedAt: "Mon Jul 16 09:00:00 2026",
  }
  const state = {
    pid: 42,
    port: 4179,
    process: processIdentity,
    startedAt: "2026-07-16T01:00:00.000Z",
    token: "test-token",
  }

  assert.equal(settingsServerIdentityMatches(state, processIdentity), true)
})

test("stopSettingsServer signals the verified server and removes its state", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-stop-"))
  const processIdentity = {
    command: "/opt/node /tmp/codex-skin.js settings-server",
    startedAt: "Mon Jul 16 09:00:00 2026",
  }
  await writeFile(
    path.join(dataDirectory, "settings-server.json"),
    JSON.stringify({
      pid: 42,
      port: 4179,
      process: processIdentity,
      startedAt: "2026-07-16T01:00:00.000Z",
      token: "test-token",
    }),
  )
  const signals: Array<[number, NodeJS.Signals | 0]> = []

  try {
    assert.equal(
      await stopSettingsServer({
        dataDirectory,
        inspectProcessImpl: async () => processIdentity,
        killProcessImpl: (pid, signal) => {
          signals.push([pid, signal])
          return true
        },
      }),
      42,
    )
    assert.deepEqual(signals, [[42, "SIGTERM"]])
    await assert.rejects(() => access(path.join(dataDirectory, "settings-server.json")), {
      code: "ENOENT",
    })
  } finally {
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

async function authenticatedSession(url: string) {
  const bootstrap = await fetch(url, { redirect: "manual" })
  assert.equal(bootstrap.status, 303)
  const setCookie = bootstrap.headers.get("set-cookie")
  assert.ok(setCookie)
  const cookie = setCookie.split(";", 1)[0] || ""
  return { cookie, origin: new URL(url).origin }
}

test("settings server requires its random session cookie", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-"))
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-skin.ts",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
  })
  try {
    const unauthorized = await fetch(`${new URL(instance.url).origin}/api/state`)
    assert.equal(unauthorized.status, 403)

    const { cookie, origin } = await authenticatedSession(instance.url)
    const authorized = await fetch(`${origin}/api/state`, { headers: { cookie } })
    assert.equal(authorized.status, 200)
    const state = (await authorized.json()) as { config: { version: number } }
    assert.equal(state.config.version, 6)
  } finally {
    await new Promise<void>((resolve) => instance.server.close(() => resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("settings server redirects an authenticated development session to the Vite UI", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-"))
  const instance = await listenSettingsServer({
    authenticatedRedirectUrl: "http://127.0.0.1:4178/",
    dataDirectory,
    entryPath: "/tmp/codex-skin.ts",
    token: "development-token",
    isCdpAvailableImpl: async () => false,
  })
  try {
    const bootstrap = await fetch(instance.url, { redirect: "manual" })
    assert.equal(bootstrap.status, 303)
    assert.equal(bootstrap.headers.get("location"), "http://127.0.0.1:4178/")
    assert.match(bootstrap.headers.get("set-cookie") || "", /codex_skin_settings=/)
  } finally {
    await new Promise<void>((resolve) => instance.server.close(() => resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("settings server saves controls and accepts a local image upload", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-"))
  const originalImage = path.join(dataDirectory, "original.jpg")
  await writeFile(originalImage, Buffer.from([0xff, 0xd8, 0xff]))
  await writeConfig({ image: originalImage }, { dataDirectory })
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-skin.ts",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
  })
  try {
    const { cookie, origin } = await authenticatedSession(instance.url)
    const savedResponse = await fetch(`${origin}/api/config`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        illustrationSize: 440,
        illustrationX: 68,
        illustrationBlur: 9,
        illustrationOpacity: 0.72,
        port: 4444,
      }),
    })
    assert.equal(savedResponse.status, 200)
    const saved = (await savedResponse.json()) as {
      application: { reason: string }
      config: {
        surfaces: {
          main: {
            illustrationBlur: number
            illustrationOpacity: number
            illustrationSize: number
            illustrationX: number
          }
        }
        port: number
      }
    }
    assert.equal(saved.config.surfaces.main.illustrationSize, 440)
    assert.equal(saved.config.surfaces.main.illustrationX, 68)
    assert.equal(saved.config.surfaces.main.illustrationBlur, 9)
    assert.equal(saved.config.surfaces.main.illustrationOpacity, 0.72)
    assert.equal(saved.config.port, 9229)
    assert.equal(saved.application.reason, "cdp-unavailable")

    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFAgIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    )
    const uploadResponse = await fetch(`${origin}/api/image`, {
      method: "POST",
      headers: { cookie, "content-type": "image/png" },
      body: transparentPng,
    })
    assert.equal(uploadResponse.status, 200)
    const uploaded = (await uploadResponse.json()) as {
      config: { surfaces: { main: { image: string } } }
    }
    assert.match(uploaded.config.surfaces.main.image, /images\/background-main-\d+\.png$/)
    await access(uploaded.config.surfaces.main.image)
    assert.deepEqual(await readFile(uploaded.config.surfaces.main.image), transparentPng)
    assert.equal(
      (await readConfig({ dataDirectory })).surfaces.main.image,
      uploaded.config.surfaces.main.image,
    )

    const sidebarImage = Buffer.from([0x52, 0x49, 0x46, 0x46])
    const sidebarUploadResponse = await fetch(`${origin}/api/surfaces/sidebar/image`, {
      method: "POST",
      headers: { cookie, "content-type": "image/webp" },
      body: sidebarImage,
    })
    assert.equal(sidebarUploadResponse.status, 200)
    const sidebarUploaded = (await sidebarUploadResponse.json()) as {
      config: {
        surfaces: {
          main: { image: string }
          sidebar: { enabled: boolean; image: string }
        }
      }
    }
    assert.equal(sidebarUploaded.config.surfaces.main.image, uploaded.config.surfaces.main.image)
    assert.equal(sidebarUploaded.config.surfaces.sidebar.enabled, true)
    assert.match(
      sidebarUploaded.config.surfaces.sidebar.image,
      /images\/background-sidebar-\d+\.webp$/,
    )
    assert.deepEqual(await readFile(sidebarUploaded.config.surfaces.sidebar.image), sidebarImage)

    const wallpaperResponse = await fetch(`${origin}/api/wallpaper/image`, {
      method: "POST",
      headers: { cookie, "content-type": "image/png" },
      body: transparentPng,
    })
    assert.equal(wallpaperResponse.status, 200)
    const wallpaperUploaded = (await wallpaperResponse.json()) as {
      config: { wallpaper: { enabled: boolean; image: string } }
    }
    assert.equal(wallpaperUploaded.config.wallpaper.enabled, true)
    assert.match(wallpaperUploaded.config.wallpaper.image, /images\/background-wallpaper-\d+\.png$/)

    const wallpaperSettingsResponse = await fetch(`${origin}/api/config`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        wallpaper: {
          backgroundTransparency: 0.35,
          fit: "contain",
          positionX: 24,
          positionY: 76,
        },
      }),
    })
    const wallpaperSettings = (await wallpaperSettingsResponse.json()) as {
      config: {
        wallpaper: {
          backgroundTransparency: number
          fit: string
          positionX: number
          positionY: number
        }
      }
    }
    assert.equal(wallpaperSettings.config.wallpaper.backgroundTransparency, 0.35)
    assert.equal(wallpaperSettings.config.wallpaper.fit, "contain")
    assert.equal(wallpaperSettings.config.wallpaper.positionX, 24)
    assert.equal(wallpaperSettings.config.wallpaper.positionY, 76)

    const sidebarSettingsResponse = await fetch(`${origin}/api/config`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        surfaces: { sidebar: { illustrationSize: 230, illustrationOpacity: 0.2 } },
      }),
    })
    const sidebarSettings = (await sidebarSettingsResponse.json()) as {
      config: {
        surfaces: {
          main: { illustrationSize: number }
          sidebar: { illustrationOpacity: number; illustrationSize: number }
        }
      }
    }
    assert.equal(sidebarSettings.config.surfaces.main.illustrationSize, 440)
    assert.equal(sidebarSettings.config.surfaces.sidebar.illustrationSize, 230)
    assert.equal(sidebarSettings.config.surfaces.sidebar.illustrationOpacity, 0.2)
  } finally {
    await new Promise<void>((resolve) => instance.server.close(() => resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("global enable updates synchronize both surface switches", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-"))
  await writeConfig(
    {
      surfaces: {
        main: { enabled: true },
        sidebar: { enabled: false },
      },
    },
    { dataDirectory },
  )
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-skin.ts",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
  })
  try {
    const { cookie, origin } = await authenticatedSession(instance.url)
    const response = await fetch(`${origin}/api/config`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    })
    assert.equal(response.status, 200)
    const payload = (await response.json()) as {
      config: {
        enabled: boolean
        wallpaper: { enabled: boolean }
        surfaces: { main: { enabled: boolean }; sidebar: { enabled: boolean } }
      }
    }
    assert.equal(payload.config.enabled, false)
    assert.equal(payload.config.wallpaper.enabled, false)
    assert.equal(payload.config.surfaces.main.enabled, false)
    assert.equal(payload.config.surfaces.sidebar.enabled, false)

    const enabledResponse = await fetch(`${origin}/api/config`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    })
    assert.equal(enabledResponse.status, 200)
    const enabledPayload = (await enabledResponse.json()) as typeof payload
    assert.equal(enabledPayload.config.enabled, true)
    assert.equal(enabledPayload.config.wallpaper.enabled, true)
    assert.equal(enabledPayload.config.surfaces.main.enabled, true)
    assert.equal(enabledPayload.config.surfaces.sidebar.enabled, true)
  } finally {
    await new Promise<void>((resolve) => instance.server.close(() => resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("settings server restarts Codex only after explicit confirmation", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-"))
  const image = path.join(dataDirectory, "wallpaper.jpg")
  await writeFile(image, Buffer.from([0xff, 0xd8, 0xff]))
  await writeConfig({ image }, { dataDirectory })
  const restartChoices: boolean[] = []
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-skin.ts",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
    startConfiguredBackgroundImpl: async (_config, options) => {
      restartChoices.push(options.restartRunningCodex === true)
      return { applied: true, mode: "started", targets: 1 }
    },
  })
  try {
    const { cookie, origin } = await authenticatedSession(instance.url)
    const firstResponse = await fetch(`${origin}/api/start`, {
      method: "POST",
      headers: { cookie },
    })
    assert.equal(firstResponse.status, 200)

    const confirmedResponse = await fetch(`${origin}/api/start`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ restartRunningCodex: true }),
    })
    assert.equal(confirmedResponse.status, 200)
    assert.deepEqual(restartChoices, [false, true])
  } finally {
    await new Promise<void>((resolve) => instance.server.close(() => resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})

test("surface uploads keep shared image files until the final reference changes", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-skin-settings-"))
  const imageDirectory = path.join(dataDirectory, "images")
  const sharedImage = path.join(imageDirectory, "background-shared.png")
  await mkdir(imageDirectory)
  await writeFile(sharedImage, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  await writeConfig(
    {
      surfaces: {
        main: { enabled: true, image: sharedImage },
        sidebar: { enabled: true, image: sharedImage },
      },
    },
    { dataDirectory },
  )
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-skin.ts",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
  })
  try {
    const { cookie, origin } = await authenticatedSession(instance.url)
    const image = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFAgIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    )
    for (const surface of ["main", "sidebar"]) {
      const response = await fetch(`${origin}/api/surfaces/${surface}/image`, {
        method: "POST",
        headers: { cookie, "content-type": "image/png" },
        body: image,
      })
      assert.equal(response.status, 200)
      if (surface === "main") await access(sharedImage)
    }
    await assert.rejects(() => access(sharedImage), { code: "ENOENT" })
  } finally {
    await new Promise<void>((resolve) => instance.server.close(() => resolve()))
    await rm(dataDirectory, { recursive: true, force: true })
  }
})
