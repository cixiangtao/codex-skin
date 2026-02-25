import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BackgroundStateError,
  backgroundStatus,
  startConfiguredBackground,
  syncConfiguredBackground,
} from "./background-service.mjs";
import { readConfig, resolveDataDirectory, writeConfig } from "./config.mjs";
import { imageFileToDataUrl } from "./css.mjs";
import { readDaemonPid } from "./daemon.mjs";

const MAX_JSON_BYTES = 64 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui");
const COOKIE_NAME = "codex_background_settings";
const EDITABLE_CONFIG_KEYS = new Set([
  "enabled",
  "illustrationSize",
  "illustrationX",
  "illustrationY",
  "illustrationBlur",
  "illustrationOpacity",
]);
const IMAGE_EXTENSIONS = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const STATIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

function runtimePath(options = {}) {
  return path.join(options.dataDirectory || resolveDataDirectory(options.env), "settings-server.json");
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function securityHeaders(response) {
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-security-policy", "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("cross-origin-resource-policy", "same-origin");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
}

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function requestIsAuthenticated(request, token) {
  const cookies = String(request.headers.cookie || "")
    .split(";")
    .map((value) => value.trim().split("="));
  return cookies.some(([name, value]) => name === COOKIE_NAME && value === token);
}

async function readBody(request, maximumBytes) {
  const chunks = [];
  let bytes = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximumBytes) tooLarge = true;
    else chunks.push(chunk);
  }
  if (tooLarge) {
    const error = new Error(`Request body exceeds ${Math.round(maximumBytes / 1024 / 1024)} MB.`);
    error.code = "BODY_TOO_LARGE";
    throw error;
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  const body = await readBody(request, MAX_JSON_BYTES);
  try {
    return JSON.parse(body.toString("utf8") || "{}");
  } catch (cause) {
    throw new Error("Invalid JSON request body.", { cause });
  }
}

function editableConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Configuration must be a JSON object.");
  }
  return Object.fromEntries(Object.entries(input).filter(([key]) => EDITABLE_CONFIG_KEYS.has(key)));
}

async function statePayload(config, options) {
  return {
    config,
    status: {
      ...(await backgroundStatus(config, options)),
      daemonRunning: Boolean(await readDaemonPid({ dataDirectory: options.dataDirectory })),
    },
  };
}

async function saveAndSync(input, options) {
  const current = await readConfig({ dataDirectory: options.dataDirectory });
  const config = await writeConfig(
    { ...current, ...editableConfig(input) },
    { dataDirectory: options.dataDirectory },
  );
  const application = await syncConfiguredBackground(config, options);
  return { ...(await statePayload(config, options)), application };
}

async function uploadImage(request, options) {
  const mediaType = String(request.headers["content-type"] || "").split(";", 1)[0].toLowerCase();
  const extension = IMAGE_EXTENSIONS.get(mediaType);
  if (!extension) throw new Error("Choose a PNG, JPEG, WebP, GIF, or AVIF image.");
  const contents = await readBody(request, MAX_IMAGE_BYTES);
  if (contents.length === 0) throw new Error("The selected image is empty.");

  const imageDirectory = path.join(options.dataDirectory, "images");
  await mkdir(imageDirectory, { recursive: true, mode: 0o700 });
  const target = path.join(imageDirectory, `background-${Date.now()}${extension}`);
  const temporary = `${target}.${process.pid}.tmp${extension}`;
  await writeFile(temporary, contents, { mode: 0o600 });
  try {
    await imageFileToDataUrl(temporary);
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  const previous = await readConfig({ dataDirectory: options.dataDirectory });
  const config = await writeConfig({ ...previous, image: target }, { dataDirectory: options.dataDirectory });
  if (previous.image?.startsWith(`${imageDirectory}${path.sep}`) && previous.image !== target) {
    await rm(previous.image, { force: true });
  }
  const application = await syncConfiguredBackground(config, options);
  return { ...(await statePayload(config, options)), application };
}

function statusForError(error) {
  if (error?.code === "BODY_TOO_LARGE") return 413;
  if (error instanceof BackgroundStateError) {
    return error.code === "RESTART_REQUIRED" ? 409 : 400;
  }
  return 400;
}

export function createSettingsHttpServer(options = {}) {
  const token = options.token || randomBytes(24).toString("hex");
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env);
  const runtimeOptions = { ...options, dataDirectory };

  const server = http.createServer(async (request, response) => {
    securityHeaders(response);
    const url = new URL(request.url || "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/" && url.searchParams.get("token")) {
      if (url.searchParams.get("token") !== token) {
        sendJson(response, 403, { error: "Invalid settings session." });
        return;
      }
      response.statusCode = 303;
      response.setHeader(
        "set-cookie",
        `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/`,
      );
      response.setHeader("location", "/");
      response.end();
      return;
    }

    if (!requestIsAuthenticated(request, token)) {
      sendJson(response, 403, { error: "Open the settings page from codex-background settings." });
      return;
    }

    try {
      if (request.method === "GET" && STATIC_FILES.has(url.pathname)) {
        const [fileName, contentType] = STATIC_FILES.get(url.pathname);
        response.statusCode = 200;
        response.setHeader("content-type", contentType);
        response.end(await readFile(path.join(uiRoot, fileName)));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/state") {
        const config = await readConfig({ dataDirectory });
        sendJson(response, 200, await statePayload(config, runtimeOptions));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/image") {
        const config = await readConfig({ dataDirectory });
        if (!config.image) {
          response.statusCode = 404;
          response.end();
          return;
        }
        const extension = path.extname(config.image).toLowerCase();
        const mediaType = [...IMAGE_EXTENSIONS.entries()].find(([, value]) => value === extension)?.[0]
          || (extension === ".jpeg" ? "image/jpeg" : null);
        if (!mediaType) throw new Error("The configured image type is not supported.");
        response.statusCode = 200;
        response.setHeader("content-type", mediaType);
        response.end(await readFile(config.image));
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/config") {
        sendJson(response, 200, await saveAndSync(await readJsonBody(request), runtimeOptions));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/image") {
        sendJson(response, 200, await uploadImage(request, runtimeOptions));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/start") {
        const config = await readConfig({ dataDirectory });
        const application = await startConfiguredBackground(config, runtimeOptions);
        sendJson(response, 200, { ...(await statePayload(config, runtimeOptions)), application });
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      sendJson(response, statusForError(error), { code: error.code || "BAD_REQUEST", error: error.message });
    }
  });

  return { server, token, dataDirectory };
}

export async function listenSettingsServer(options = {}) {
  const instance = createSettingsHttpServer(options);
  await new Promise((resolve, reject) => {
    instance.server.once("error", reject);
    instance.server.listen(options.port || 0, "127.0.0.1", resolve);
  });
  const address = instance.server.address();
  const state = {
    pid: process.pid,
    port: address.port,
    token: instance.token,
    startedAt: new Date().toISOString(),
  };
  return {
    ...instance,
    state,
    url: `http://127.0.0.1:${state.port}/?token=${state.token}`,
  };
}

export async function runSettingsServerDaemon(options = {}) {
  const instance = await listenSettingsServer(options);
  const statePath = runtimePath({ dataDirectory: instance.dataDirectory });
  await mkdir(instance.dataDirectory, { recursive: true, mode: 0o700 });
  await writeFile(statePath, `${JSON.stringify(instance.state, null, 2)}\n`, { mode: 0o600 });

  const close = () => instance.server.close();
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
  await new Promise((resolve) => instance.server.once("close", resolve));
  const current = await readSettingsServerState({ dataDirectory: instance.dataDirectory });
  if (!current || current.pid === process.pid) await unlink(statePath).catch(() => undefined);
}

export async function readSettingsServerState(options = {}) {
  try {
    const state = JSON.parse(await readFile(runtimePath(options), "utf8"));
    return processIsAlive(state.pid) ? state : null;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function ensureSettingsServer({ entryPath, spawnImpl = spawn, ...options }) {
  const existing = await readSettingsServerState(options);
  if (existing) {
    return {
      ...existing,
      started: false,
      url: `http://127.0.0.1:${existing.port}/?token=${existing.token}`,
    };
  }
  await rm(runtimePath(options), { force: true });

  const child = spawnImpl(process.execPath, [entryPath, "settings-server"], {
    detached: true,
    env: process.env,
    stdio: "ignore",
  });
  child.unref();

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const state = await readSettingsServerState(options);
    if (state?.pid === child.pid) {
      return {
        ...state,
        started: true,
        url: `http://127.0.0.1:${state.port}/?token=${state.token}`,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The settings server did not start within 5 seconds.");
}

export function openSettingsPage(url, options = {}) {
  const child = (options.spawnImpl || spawn)("open", [url], { detached: true, stdio: "ignore" });
  child.unref();
}
