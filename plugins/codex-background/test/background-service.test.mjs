import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BackgroundStateError,
  startConfiguredBackground,
  syncConfiguredBackground,
} from "../src/background-service.mjs";
import { normalizeConfig } from "../src/config.mjs";

test("syncConfiguredBackground removes injected styling when disabled", async () => {
  const calls = [];
  const result = await syncConfiguredBackground(normalizeConfig({ enabled: false }), {
    isCdpAvailableImpl: async () => true,
    stopDaemonImpl: async () => {
      calls.push("stop");
      return 42;
    },
    removeFromAllTargetsImpl: async () => {
      calls.push("remove");
      return 2;
    },
  });

  assert.deepEqual(calls, ["stop", "remove"]);
  assert.deepEqual(result, { applied: true, mode: "removed", pid: 42, targets: 2 });
});

test("syncConfiguredBackground applies valid settings and keeps the daemon alive", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"));
  try {
    const image = path.join(directory, "wallpaper.png");
    await writeFile(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await syncConfiguredBackground(normalizeConfig({ image }), {
      entryPath: "/tmp/codex-background.mjs",
      isCdpAvailableImpl: async () => true,
      injectAllTargetsImpl: async () => [{ ok: true }, { ok: true }],
      ensureDaemonImpl: async ({ entryPath }) => ({ pid: 9, entryPath }),
    });

    assert.equal(result.applied, true);
    assert.equal(result.mode, "injected");
    assert.equal(result.targets, 2);
    assert.deepEqual(result.daemon, { pid: 9, entryPath: "/tmp/codex-background.mjs" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("startConfiguredBackground preserves a running Codex process", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "codex-background-service-"));
  try {
    const image = path.join(directory, "wallpaper.jpg");
    await writeFile(image, Buffer.from([0xff, 0xd8, 0xff]));
    await assert.rejects(
      () =>
        startConfiguredBackground(normalizeConfig({ image }), {
          entryPath: "/tmp/codex-background.mjs",
          appExecutableExistsImpl: async () => true,
          isCodexRunningImpl: async () => true,
          isCdpAvailableImpl: async () => false,
        }),
      (error) => error instanceof BackgroundStateError && error.code === "RESTART_REQUIRED",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
