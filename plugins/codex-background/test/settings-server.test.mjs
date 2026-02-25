import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { readConfig, writeConfig } from "../src/config.mjs";
import { listenSettingsServer } from "../src/settings-server.mjs";

async function authenticatedSession(url) {
  const bootstrap = await fetch(url, { redirect: "manual" });
  assert.equal(bootstrap.status, 303);
  const cookie = bootstrap.headers.get("set-cookie").split(";", 1)[0];
  return { cookie, origin: new URL(url).origin };
}

test("settings server requires its random session cookie", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-background-settings-"));
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-background.mjs",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
  });
  try {
    const unauthorized = await fetch(`${new URL(instance.url).origin}/api/state`);
    assert.equal(unauthorized.status, 403);

    const { cookie, origin } = await authenticatedSession(instance.url);
    const authorized = await fetch(`${origin}/api/state`, { headers: { cookie } });
    assert.equal(authorized.status, 200);
    assert.equal((await authorized.json()).config.version, 2);
  } finally {
    await new Promise((resolve) => instance.server.close(resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test("settings server saves controls and accepts a local image upload", async () => {
  const dataDirectory = await mkdtemp(path.join(os.tmpdir(), "codex-background-settings-"));
  const originalImage = path.join(dataDirectory, "original.jpg");
  await writeFile(originalImage, Buffer.from([0xff, 0xd8, 0xff]));
  await writeConfig({ image: originalImage }, { dataDirectory });
  const instance = await listenSettingsServer({
    dataDirectory,
    entryPath: "/tmp/codex-background.mjs",
    token: "test-token",
    isCdpAvailableImpl: async () => false,
  });
  try {
    const { cookie, origin } = await authenticatedSession(instance.url);
    const savedResponse = await fetch(`${origin}/api/config`, {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ illustrationSize: 440, illustrationX: 68, illustrationBlur: 9, illustrationOpacity: 0.72, port: 4444 }),
    });
    assert.equal(savedResponse.status, 200);
    const saved = await savedResponse.json();
    assert.equal(saved.config.illustrationSize, 440);
    assert.equal(saved.config.illustrationX, 68);
    assert.equal(saved.config.illustrationBlur, 9);
    assert.equal(saved.config.illustrationOpacity, 0.72);
    assert.equal(saved.config.port, 9229);
    assert.equal(saved.application.reason, "cdp-unavailable");

    const transparentPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAFAgIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    );
    const uploadResponse = await fetch(`${origin}/api/image`, {
      method: "POST",
      headers: { cookie, "content-type": "image/png" },
      body: transparentPng,
    });
    assert.equal(uploadResponse.status, 200);
    const uploaded = await uploadResponse.json();
    assert.match(uploaded.config.image, /images\/background-\d+\.png$/);
    await access(uploaded.config.image);
    assert.deepEqual(await readFile(uploaded.config.image), transparentPng);
    assert.equal((await readConfig({ dataDirectory })).image, uploaded.config.image);
  } finally {
    await new Promise((resolve) => instance.server.close(resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
