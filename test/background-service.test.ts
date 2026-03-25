import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { test } from "vitest"

import {
  BackgroundStateError,
  startConfiguredBackground,
  syncConfiguredBackground,
} from "../src/runtime/background-service.ts"
import { normalizeConfig } from "../src/runtime/config.ts"

test("syncConfiguredBackground removes injected styling when disabled", async () => {
  const calls: string[] = []
  const result = await syncConfiguredBackground(normalizeConfig({ enabled: false }), {
    isCdpAvailableImpl: async () => true,
    stopDaemonImpl: async () => {
      calls.push("stop")
      return 42
    },
    removeFromAllTargetsImpl: async () => {
      calls.push("remove")
      return 2
    },
  })

  assert.deepEqual(calls, ["stop", "remove"])
  assert.deepEqual(result, { applied: true, mode: "removed", pid: 42, targets: 2 })
})

test("syncConfiguredBackground applies valid settings and keeps the daemon alive", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"))
  try {
    const image = path.join(directory, "wallpaper.png")
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const result = await syncConfiguredBackground(normalizeConfig({ image }), {
      entryPath: "/tmp/codex-background.mjs",
      isCdpAvailableImpl: async () => true,
      injectAllTargetsImpl: async () => [{ ok: true }, { ok: true }],
      ensureDaemonImpl: async ({ entryPath }) => ({ pid: 9, entryPath }),
    })

    assert.equal(result.applied, true)
    assert.equal(result.mode, "injected")
    assert.equal(result.targets, 2)
    assert.deepEqual(result.daemon, { pid: 9, entryPath: "/tmp/codex-background.mjs" })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("startConfiguredBackground preserves a running Codex process", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"))
  try {
    const image = path.join(directory, "wallpaper.jpg")
    await writeFile(image, Buffer.from([0xff, 0xd8, 0xff]))
    await assert.rejects(
      () =>
        startConfiguredBackground(normalizeConfig({ image }), {
          entryPath: "/tmp/codex-background.mjs",
          appExecutableExistsImpl: async () => true,
          isCodexRunningImpl: async () => true,
          isCdpAvailableImpl: async () => false,
        }),
      (error) => error instanceof BackgroundStateError && error.code === "RESTART_REQUIRED",
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("startConfiguredBackground rejects a fixed port owned by another process", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"))
  try {
    const image = path.join(directory, "wallpaper.png")
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await assert.rejects(
      () =>
        startConfiguredBackground(normalizeConfig({ image, port: 9341, portMode: "fixed" }), {
          entryPath: "/tmp/codex-background.mjs",
          appExecutableExistsImpl: async () => true,
          inspectCdpPortImpl: async () => ({
            codexPid: null,
            listenerPids: [99],
            state: "occupied",
          }),
          isCodexRunningImpl: async () => false,
        }),
      (error) => error instanceof BackgroundStateError && error.code === "PORT_IN_USE",
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("startConfiguredBackground moves an automatic port away from a collision", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"))
  try {
    const image = path.join(directory, "wallpaper.png")
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    let launched = false
    let savedPort = 0
    const result = await startConfiguredBackground(
      normalizeConfig({ image, port: 9229, portMode: "auto" }),
      {
        entryPath: "/tmp/codex-background.mjs",
        appExecutableExistsImpl: async () => true,
        ensureDaemonImpl: async () => ({ pid: 88 }),
        findAvailableCdpPortImpl: async () => 9230,
        injectAllTargetsImpl: async ({ port }) => [{ id: String(port), ok: true }],
        inspectCdpPortImpl: async (_appPath, port) => ({
          codexPid: launched && port === 9230 ? 42 : null,
          listenerPids: port === 9229 || launched ? [42] : [],
          state: port === 9229 ? "occupied" : launched ? "codex" : "available",
        }),
        isCdpAvailableImpl: async ({ port }) => launched && port === 9230,
        isCodexRunningImpl: async () => false,
        launchCodexImpl: ({ port }) => {
          assert.equal(port, 9230)
          launched = true
          return 42
        },
        writeConfigImpl: async (config) => {
          savedPort = config.port
          return config
        },
      },
    )

    assert.equal(savedPort, 9230)
    assert.equal(result.port, 9230)
    assert.equal(result.targets, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("syncConfiguredBackground rejects an unrelated service on the configured port", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"))
  try {
    const image = path.join(directory, "wallpaper.png")
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await assert.rejects(
      () =>
        syncConfiguredBackground(normalizeConfig({ image }), {
          inspectCdpPortImpl: async () => ({
            codexPid: null,
            listenerPids: [99],
            state: "occupied",
          }),
        }),
      (error) => error instanceof BackgroundStateError && error.code === "PORT_IN_USE",
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
