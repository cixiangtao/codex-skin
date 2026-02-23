import { access } from "node:fs/promises";

import { isCdpAvailable } from "./cdp.mjs";
import { buildBackgroundCss, imageFileToDataUrl } from "./css.mjs";
import { ensureDaemon, stopDaemon } from "./daemon.mjs";
import { injectAllTargets, removeFromAllTargets } from "./injector.mjs";
import {
  appExecutableExists,
  isCodexRunning,
  launchCodex,
  resolveAppExecutable,
} from "./macos.mjs";

export class BackgroundStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackgroundStateError";
    this.code = code;
  }
}

export async function waitForCdp(port, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const isAvailable = options.isCdpAvailableImpl || isCdpAvailable;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAvailable({ port })) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export async function injectConfiguredBackground(config, options = {}) {
  const css = await buildBackgroundCss(config);
  const inject = options.injectAllTargetsImpl || injectAllTargets;
  const results = await inject({ css, port: config.port });
  const successes = results.filter((result) => result.ok);
  if (successes.length === 0) {
    const details = results.map((result) => result.error).filter(Boolean).join("; ");
    throw new BackgroundStateError(
      "NO_TARGETS",
      `No Codex window accepted the background.${details ? ` ${details}` : ""}`,
    );
  }
  return successes.length;
}

export async function syncConfiguredBackground(config, options = {}) {
  const isAvailable = options.isCdpAvailableImpl || isCdpAvailable;
  const stop = options.stopDaemonImpl || stopDaemon;
  const remove = options.removeFromAllTargetsImpl || removeFromAllTargets;

  if (!config.enabled) {
    const pid = await stop();
    const removedTargets = (await isAvailable({ port: config.port }))
      ? await remove({ port: config.port })
      : 0;
    return { applied: true, mode: "removed", pid, targets: removedTargets };
  }

  if (!config.image) {
    return { applied: false, mode: "saved", reason: "image-missing" };
  }
  await imageFileToDataUrl(config.image);
  if (!(await isAvailable({ port: config.port }))) {
    return { applied: false, mode: "saved", reason: "cdp-unavailable" };
  }

  const targets = await injectConfiguredBackground(config, options);
  const daemon = options.entryPath
    ? await (options.ensureDaemonImpl || ensureDaemon)({ entryPath: options.entryPath })
    : null;
  return { applied: true, mode: "injected", targets, daemon };
}

export async function startConfiguredBackground(config, options = {}) {
  if (!config.enabled) {
    throw new BackgroundStateError("DISABLED", "Codex Background is disabled.");
  }
  if (!config.image) {
    throw new BackgroundStateError("IMAGE_MISSING", "No background image is configured.");
  }
  await imageFileToDataUrl(config.image);
  if (!(await (options.appExecutableExistsImpl || appExecutableExists)(config.appPath))) {
    throw new BackgroundStateError(
      "APP_MISSING",
      `ChatGPT executable not found: ${resolveAppExecutable(config.appPath)}`,
    );
  }

  const running = await (options.isCodexRunningImpl || isCodexRunning)(config.appPath);
  const cdpAvailable = await (options.isCdpAvailableImpl || isCdpAvailable)({ port: config.port });
  if (running && !cdpAvailable) {
    throw new BackgroundStateError(
      "RESTART_REQUIRED",
      "Codex is running without background support. Quit Codex normally, keep this page open, then try again.",
    );
  }
  if (!running) {
    (options.launchCodexImpl || launchCodex)({ appPath: config.appPath, port: config.port });
    if (!(await waitForCdp(config.port, options))) {
      throw new BackgroundStateError(
        "CDP_TIMEOUT",
        "Codex started, but the background connection did not become available.",
      );
    }
  }

  const targets = await injectConfiguredBackground(config, options);
  const daemon = await (options.ensureDaemonImpl || ensureDaemon)({ entryPath: options.entryPath });
  return { applied: true, mode: "started", targets, daemon };
}

export async function backgroundStatus(config, options = {}) {
  const imageReadable = config.image
    ? await access(config.image)
        .then(() => true)
        .catch(() => false)
    : false;
  return {
    cdpAvailable: await (options.isCdpAvailableImpl || isCdpAvailable)({ port: config.port }),
    imageReadable,
  };
}
