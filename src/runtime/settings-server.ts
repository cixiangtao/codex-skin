import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises"
import http from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  BackgroundStateError,
  backgroundStatus,
  startConfiguredBackground,
  syncConfiguredBackground,
} from "./background-service.ts"
import { readConfig, resolveDataDirectory, writeConfig } from "./config.ts"
import { imageFileToDataUrl } from "./css.ts"
import { readDaemonPid } from "./daemon.ts"
import type {
  BackgroundConfig,
  BackgroundConfigInput,
  DataDirectoryOptions,
  SpawnImplementation,
} from "./types.ts"
import { errorCode, errorMessage } from "./types.ts"

const MAX_JSON_BYTES = 64 * 1024
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000
const defaultUiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/ui")
const COOKIE_NAME = "codex_background_settings"
const EDITABLE_CONFIG_KEYS = new Set([
  "enabled",
  "illustrationSize",
  "illustrationX",
  "illustrationY",
  "illustrationBlur",
  "illustrationOpacity",
])
const IMAGE_EXTENSIONS = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
])
const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
])

interface SettingsOptions extends DataDirectoryOptions {
  authenticatedRedirectUrl?: string
  entryPath: string
  idleTimeoutMs?: number
  isCdpAvailableImpl?: (options: { port: number }) => Promise<boolean>
  port?: number
  spawnImpl?: SpawnImplementation
  token?: string
  uiRoot?: string
}

interface SettingsServerState {
  pid: number
  port: number
  startedAt: string
  token: string
}

function runtimePath(options: DataDirectoryOptions = {}) {
  return path.join(
    options.dataDirectory || resolveDataDirectory(options.env),
    "settings-server.json",
  )
}

function processIsAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function securityHeaders(response: ServerResponse) {
  response.setHeader("cache-control", "no-store")
  response.setHeader(
    "content-security-policy",
    "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  )
  response.setHeader("cross-origin-resource-policy", "same-origin")
  response.setHeader("referrer-policy", "no-referrer")
  response.setHeader("x-content-type-options", "nosniff")
  response.setHeader("x-frame-options", "DENY")
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status
  response.setHeader("content-type", "application/json; charset=utf-8")
  response.end(JSON.stringify(value))
}

function requestIsAuthenticated(request: IncomingMessage, token: string) {
  const cookies = String(request.headers.cookie || "")
    .split(";")
    .map((value) => value.trim().split("="))
  return cookies.some(([name, value]) => name === COOKIE_NAME && value === token)
}

async function readBody(request: IncomingMessage, maximumBytes: number) {
  const chunks: Buffer[] = []
  let bytes = 0
  let tooLarge = false
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    bytes += buffer.length
    if (bytes > maximumBytes) tooLarge = true
    else chunks.push(buffer)
  }
  if (tooLarge) {
    throw Object.assign(
      new Error(`Request body exceeds ${Math.round(maximumBytes / 1024 / 1024)} MB.`),
      { code: "BODY_TOO_LARGE" },
    )
  }
  return Buffer.concat(chunks)
}

async function readJsonBody(request: IncomingMessage) {
  const body = await readBody(request, MAX_JSON_BYTES)
  try {
    return JSON.parse(body.toString("utf8") || "{}") as unknown
  } catch (cause) {
    throw new Error("Invalid JSON request body.", { cause })
  }
}

function editableConfig(input: unknown): BackgroundConfigInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Configuration must be a JSON object.")
  }
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => EDITABLE_CONFIG_KEYS.has(key)),
  ) as BackgroundConfigInput
}

async function statePayload(config: BackgroundConfig, options: SettingsOptions) {
  return {
    config,
    status: {
      ...(await backgroundStatus(config, options)),
      daemonRunning: Boolean(await readDaemonPid({ dataDirectory: options.dataDirectory })),
    },
  }
}

async function saveAndSync(input: unknown, options: SettingsOptions) {
  const current = await readConfig({ dataDirectory: options.dataDirectory })
  const config = await writeConfig(
    { ...current, ...editableConfig(input) },
    { dataDirectory: options.dataDirectory },
  )
  const application = await syncConfiguredBackground(config, options)
  return { ...(await statePayload(config, options)), application }
}

async function uploadImage(request: IncomingMessage, options: SettingsOptions) {
  const mediaType = String(request.headers["content-type"] || "")
    .split(";", 1)[0]
    ?.toLowerCase()
  const extension = mediaType ? IMAGE_EXTENSIONS.get(mediaType) : undefined
  if (!extension) throw new Error("Choose a PNG, JPEG, WebP, GIF, or AVIF image.")
  const contents = await readBody(request, MAX_IMAGE_BYTES)
  if (contents.length === 0) throw new Error("The selected image is empty.")

  const imageDirectory = path.join(options.dataDirectory || resolveDataDirectory(), "images")
  await mkdir(imageDirectory, { recursive: true, mode: 0o700 })
  const now = Date.now()
  const target = path.join(imageDirectory, `background-${now}${extension}`)
  const temporary = `${target}.${process.pid}.tmp${extension}`
  await writeFile(temporary, contents, { mode: 0o600 })
  try {
    await imageFileToDataUrl(temporary)
    await rename(temporary, target)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }

  const previous = await readConfig({ dataDirectory: options.dataDirectory })
  const config = await writeConfig(
    { ...previous, image: target },
    { dataDirectory: options.dataDirectory },
  )
  if (previous.image?.startsWith(`${imageDirectory}${path.sep}`) && previous.image !== target) {
    await rm(previous.image, { force: true })
  }
  const application = await syncConfiguredBackground(config, options)
  return { ...(await statePayload(config, options)), application }
}

function statusForError(error: unknown) {
  if (errorCode(error) === "BODY_TOO_LARGE") return 413
  if (error instanceof BackgroundStateError) return error.code === "RESTART_REQUIRED" ? 409 : 400
  return 400
}

async function serveStaticFile(response: ServerResponse, pathname: string, uiRoot: string) {
  const relativePath =
    pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "")
  const filePath = path.resolve(uiRoot, relativePath)
  if (filePath !== uiRoot && !filePath.startsWith(`${uiRoot}${path.sep}`)) return false
  try {
    const metadata = await stat(filePath)
    if (!metadata.isFile()) return false
    response.statusCode = 200
    response.setHeader(
      "content-type",
      CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    )
    response.end(await readFile(filePath))
    return true
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false
    throw error
  }
}

export function createSettingsHttpServer(options: SettingsOptions) {
  const token = options.token || randomBytes(24).toString("hex")
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  const uiRoot = options.uiRoot || defaultUiRoot
  const runtimeOptions = { ...options, dataDirectory }
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const server = http.createServer(async (request, response) => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => server.close(), options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
    idleTimer.unref()
    securityHeaders(response)
    const url = new URL(request.url || "/", "http://127.0.0.1")

    if (request.method === "GET" && url.pathname === "/" && url.searchParams.get("token")) {
      if (url.searchParams.get("token") !== token) {
        sendJson(response, 403, { error: "Invalid settings session." })
        return
      }
      response.statusCode = 303
      response.setHeader("set-cookie", `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/`)
      response.setHeader("location", options.authenticatedRedirectUrl || "/")
      response.end()
      return
    }

    if (!requestIsAuthenticated(request, token)) {
      sendJson(response, 403, { error: "Open the settings page from codex-background settings." })
      return
    }

    try {
      if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
        if (await serveStaticFile(response, url.pathname, uiRoot)) return
      }

      if (request.method === "GET" && url.pathname === "/api/state") {
        const config = await readConfig({ dataDirectory })
        sendJson(response, 200, await statePayload(config, runtimeOptions))
        return
      }

      if (request.method === "GET" && url.pathname === "/api/image") {
        const config = await readConfig({ dataDirectory })
        if (!config.image) {
          response.statusCode = 404
          response.end()
          return
        }
        const extension = path.extname(config.image).toLowerCase()
        const mediaType =
          [...IMAGE_EXTENSIONS.entries()].find(([, value]) => value === extension)?.[0] ||
          (extension === ".jpeg" ? "image/jpeg" : null)
        if (!mediaType) throw new Error("The configured image type is not supported.")
        response.statusCode = 200
        response.setHeader("content-type", mediaType)
        response.end(await readFile(config.image))
        return
      }

      if (request.method === "PUT" && url.pathname === "/api/config") {
        sendJson(response, 200, await saveAndSync(await readJsonBody(request), runtimeOptions))
        return
      }

      if (request.method === "POST" && url.pathname === "/api/image") {
        sendJson(response, 200, await uploadImage(request, runtimeOptions))
        return
      }

      if (request.method === "POST" && url.pathname === "/api/start") {
        const config = await readConfig({ dataDirectory })
        const application = await startConfiguredBackground(config, runtimeOptions)
        sendJson(response, 200, {
          ...(await statePayload(config, runtimeOptions)),
          application,
        })
        return
      }

      sendJson(response, 404, { error: "Not found." })
    } catch (error) {
      sendJson(response, statusForError(error), {
        code: errorCode(error) || "BAD_REQUEST",
        error: errorMessage(error),
      })
    }
  })

  server.once("close", () => clearTimeout(idleTimer))
  return { server, token, dataDirectory }
}

export async function listenSettingsServer(options: SettingsOptions) {
  const instance = createSettingsHttpServer(options)
  await new Promise<void>((resolve, reject) => {
    instance.server.once("error", reject)
    instance.server.listen(options.port || 0, "127.0.0.1", resolve)
  })
  const address = instance.server.address() as AddressInfo
  const state: SettingsServerState = {
    pid: process.pid,
    port: address.port,
    token: instance.token,
    startedAt: new Date().toISOString(),
  }
  return {
    ...instance,
    state,
    url: `http://127.0.0.1:${state.port}/?token=${state.token}`,
  }
}

export async function runSettingsServerDaemon(options: SettingsOptions) {
  const instance = await listenSettingsServer(options)
  const statePath = runtimePath({ dataDirectory: instance.dataDirectory })
  await mkdir(instance.dataDirectory, { recursive: true, mode: 0o700 })
  await writeFile(statePath, `${JSON.stringify(instance.state, null, 2)}\n`, { mode: 0o600 })

  const close = () => instance.server.close()
  process.once("SIGTERM", close)
  process.once("SIGINT", close)
  await new Promise<void>((resolve) => instance.server.once("close", resolve))
  const current = await readSettingsServerState({ dataDirectory: instance.dataDirectory })
  if (!current || current.pid === process.pid) await unlink(statePath).catch(() => undefined)
}

export async function readSettingsServerState(
  options: DataDirectoryOptions = {},
): Promise<SettingsServerState | null> {
  try {
    const state = JSON.parse(await readFile(runtimePath(options), "utf8")) as SettingsServerState
    return processIsAlive(state.pid) ? state : null
  } catch (error) {
    if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

export async function ensureSettingsServer({
  entryPath,
  spawnImpl = spawn as SpawnImplementation,
  ...options
}: SettingsOptions) {
  const existing = await readSettingsServerState(options)
  if (existing) {
    return {
      ...existing,
      started: false,
      url: `http://127.0.0.1:${existing.port}/?token=${existing.token}`,
    }
  }
  await rm(runtimePath(options), { force: true })

  const child = spawnImpl(process.execPath, [entryPath, "settings-server"], {
    detached: true,
    env: process.env,
    stdio: "ignore",
  })
  child.unref()
  if (!child.pid) throw new Error("Unable to start the settings server.")

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const state = await readSettingsServerState(options)
    if (state?.pid === child.pid) {
      return {
        ...state,
        started: true,
        url: `http://127.0.0.1:${state.port}/?token=${state.token}`,
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("The settings server did not start within 5 seconds.")
}

export function openSettingsPage(url: string, options: { spawnImpl?: SpawnImplementation } = {}) {
  const child = (options.spawnImpl || (spawn as SpawnImplementation))("open", [url], {
    detached: true,
    stdio: "ignore",
  })
  child.unref()
}
