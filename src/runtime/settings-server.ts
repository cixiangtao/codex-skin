import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  copyFile,
  chmod,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises"
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
import {
  codexSkinProcessCommandMatches,
  inspectProcess,
  listProcesses,
  processIdentityMatches,
  terminateProcesses,
} from "./process.ts"
import type { ProcessIdentity, ProcessSummary } from "./process.ts"
import { startBackgroundRestartWorker } from "./restart-worker.ts"
import type {
  BackgroundConfig,
  BackgroundConfigInput,
  BackgroundImageTarget,
  BackgroundSurface,
  DataDirectoryOptions,
  SpawnImplementation,
  SurfaceBackgroundConfigInput,
  WallpaperConfigInput,
} from "./types.ts"
import { BACKGROUND_SURFACES, errorCode, errorMessage } from "./types.ts"

const MAX_JSON_BYTES = 64 * 1024
const MAX_IMAGE_BYTES = 25 * 1024 * 1024
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000
const defaultUiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../dist/ui")
const COOKIE_NAME = "codex_skin_settings"
const EDITABLE_CONFIG_KEYS = new Set(["enabled"])
const EDITABLE_WALLPAPER_KEYS = new Set([
  "backgroundTransparency",
  "enabled",
  "fit",
  "positionX",
  "positionY",
])
const EDITABLE_SURFACE_KEYS = new Set([
  "enabled",
  "illustrationSize",
  "illustrationX",
  "illustrationY",
  "illustrationBlur",
  "illustrationOpacity",
])
const LEGACY_MAIN_SURFACE_KEYS = new Set(
  [...EDITABLE_SURFACE_KEYS].filter((key) => key !== "enabled"),
)
const IMAGE_EXTENSIONS = new Map([
  ["image/avif", ".avif"],
  ["image/gif", ".gif"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
])
const CONTENT_TYPES = new Map([
  [".avif", "image/avif"],
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
])
const BUNDLED_BACKGROUND_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"])
const BACKGROUND_IMAGE_TARGETS = ["wallpaper", ...BACKGROUND_SURFACES] as const

type KillProcess = (pid: number, signal: NodeJS.Signals | 0) => boolean

interface SettingsProcessOptions extends DataDirectoryOptions {
  inspectProcessImpl?: (pid: number) => Promise<ProcessIdentity | null>
  killProcessImpl?: KillProcess
  listProcessesImpl?: () => Promise<ProcessSummary[]>
}

interface SettingsOptions extends SettingsProcessOptions {
  authenticatedRedirectUrl?: string
  backgroundsRoot?: string
  entryPath: string
  idleTimeoutMs?: number
  isCdpAvailableImpl?: (options: { port: number }) => Promise<boolean>
  port?: number
  spawnImpl?: SpawnImplementation
  startBackgroundRestartWorkerImpl?: typeof startBackgroundRestartWorker
  startConfiguredBackgroundImpl?: typeof startConfiguredBackground
  token?: string
  uiRoot?: string
}

interface BundledBackgroundOption {
  file: string
  label: string
  url: string
}

type BundledBackgroundCatalog = Record<
  BackgroundImageTarget,
  { items: BundledBackgroundOption[]; selected: string | null }
>

interface SettingsServerState {
  pid: number
  port: number
  process?: ProcessIdentity
  startedAt: string
  token: string
}

interface SettingsServerIdentity extends ProcessIdentity {
  pid: number
}

function runtimePaths(options: DataDirectoryOptions = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return {
    lock: path.join(dataDirectory, "settings-server.lock"),
    state: path.join(dataDirectory, "settings-server.json"),
  }
}

export function settingsServerIdentityMatches(
  state: SettingsServerState,
  actual: ProcessIdentity | null,
) {
  if (
    !actual ||
    !/(?:^|[\\/])codex-skin(?:\.(?:js|ts))?\s+settings-server(?:\s|$)/.test(actual.command)
  ) {
    return false
  }
  if (!state.process) return true
  return actual.command === state.process.command && actual.startedAt === state.process.startedAt
}

async function readSettingsServerIdentity(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as SettingsServerIdentity
  } catch (error) {
    if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

async function readVerifiedSettingsServerIdentity(
  filePath: string,
  options: SettingsProcessOptions,
) {
  const identity = await readSettingsServerIdentity(filePath)
  if (!identity) return null
  const actual = await (options.inspectProcessImpl || inspectProcess)(identity.pid)
  return processIdentityMatches(identity, actual) ? identity : null
}

async function claimSettingsServerLock(
  identity: SettingsServerIdentity,
  options: SettingsProcessOptions,
) {
  const lockPath = runtimePaths(options).lock
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await writeFile(lockPath, `${JSON.stringify(identity, null, 2)}\n`, {
        flag: "wx",
        mode: 0o600,
      })
      return true
    } catch (error) {
      if (errorCode(error) !== "EEXIST") throw error
      if (await readVerifiedSettingsServerIdentity(lockPath, options)) return false
      await rm(lockPath, { force: true })
    }
  }
  return false
}

async function releaseSettingsServerLock(pid: number, options: SettingsProcessOptions) {
  const lockPath = runtimePaths(options).lock
  const owner = await readSettingsServerIdentity(lockPath)
  if (owner?.pid === pid) await rm(lockPath, { force: true })
}

/** Returns every independently launched settings server except the caller. */
export function settingsServerPidsFromProcesses(
  processes: ProcessSummary[],
  currentPid = process.pid,
) {
  return processes
    .filter(
      ({ command, pid }) =>
        pid !== currentPid && codexSkinProcessCommandMatches(command, "settings-server"),
    )
    .map(({ pid }) => pid)
}

async function discoveredSettingsServerPids(options: SettingsProcessOptions) {
  const activeDataDirectory = path.resolve(
    options.dataDirectory || resolveDataDirectory(options.env),
  )
  const defaultDataDirectory = path.resolve(resolveDataDirectory(options.env))
  if (!options.listProcessesImpl && activeDataDirectory !== defaultDataDirectory) return []
  return settingsServerPidsFromProcesses(await (options.listProcessesImpl || listProcesses)())
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
  const source = input as Record<string, unknown>
  const result = Object.fromEntries(
    Object.entries(source).filter(([key]) => EDITABLE_CONFIG_KEYS.has(key)),
  ) as BackgroundConfigInput
  const surfaces =
    source.surfaces && typeof source.surfaces === "object" && !Array.isArray(source.surfaces)
      ? (source.surfaces as Record<string, unknown>)
      : {}
  const surfaceUpdates: Partial<Record<BackgroundSurface, SurfaceBackgroundConfigInput>> = {}
  let wallpaperUpdate: WallpaperConfigInput | undefined
  if (result.enabled !== undefined) {
    for (const surface of BACKGROUND_SURFACES) {
      surfaceUpdates[surface] = { enabled: Boolean(result.enabled) }
    }
    wallpaperUpdate = { enabled: Boolean(result.enabled) }
  }
  const wallpaper = source.wallpaper
  if (wallpaper && typeof wallpaper === "object" && !Array.isArray(wallpaper)) {
    wallpaperUpdate = {
      ...wallpaperUpdate,
      ...Object.fromEntries(
        Object.entries(wallpaper).filter(([key]) => EDITABLE_WALLPAPER_KEYS.has(key)),
      ),
    }
  }
  const legacyMainUpdate = Object.fromEntries(
    Object.entries(source).filter(([key]) => LEGACY_MAIN_SURFACE_KEYS.has(key)),
  )
  if (Object.keys(legacyMainUpdate).length > 0) {
    surfaceUpdates.main = { ...surfaceUpdates.main, ...legacyMainUpdate }
  }
  for (const surface of BACKGROUND_SURFACES) {
    const candidate = surfaces[surface]
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue
    surfaceUpdates[surface] = {
      ...surfaceUpdates[surface],
      ...Object.fromEntries(
        Object.entries(candidate).filter(([key]) => EDITABLE_SURFACE_KEYS.has(key)),
      ),
    }
  }
  if (Object.keys(surfaceUpdates).length > 0) result.surfaces = surfaceUpdates
  if (wallpaperUpdate) result.wallpaper = wallpaperUpdate
  return result
}

function configuredImage(config: BackgroundConfig, target: BackgroundImageTarget) {
  return target === "wallpaper" ? config.wallpaper.image : config.surfaces[target].image
}

function bundledBackgroundDestinationName(target: BackgroundImageTarget, file: string) {
  return `builtin-${target}-${file}`
}

function bundledBackgroundLabel(file: string) {
  return path.basename(file, path.extname(file)).replace(/[-_]+/g, " ").trim()
}

/** Reads supported image files directly from one bundled background directory. */
async function bundledBackgroundItems(
  target: BackgroundImageTarget,
  options: SettingsOptions,
): Promise<BundledBackgroundOption[]> {
  const directory = path.join(options.backgroundsRoot || "", target)
  try {
    const entries = await readdir(directory, { withFileTypes: true })
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          BUNDLED_BACKGROUND_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
      )
      .map((entry) => ({
        file: entry.name,
        label: bundledBackgroundLabel(entry.name),
        url: `/backgrounds/${target}/${encodeURIComponent(entry.name)}`,
      }))
      .sort((first, second) =>
        first.label.localeCompare(second.label, "zh-CN", { numeric: true, sensitivity: "base" }),
      )
  } catch (error) {
    if (errorCode(error) === "ENOENT") return []
    throw error
  }
}

/** Builds the current per-module selector options without requiring a separate manifest. */
async function bundledBackgroundCatalog(
  config: BackgroundConfig,
  options: SettingsOptions,
): Promise<BundledBackgroundCatalog> {
  const groups = await Promise.all(
    BACKGROUND_IMAGE_TARGETS.map(async (target) => {
      const items = await bundledBackgroundItems(target, options)
      const currentName = path.basename(configuredImage(config, target) || "")
      const selected =
        items.find((item) => bundledBackgroundDestinationName(target, item.file) === currentName)
          ?.file || null
      return [target, { items, selected }] as const
    }),
  )
  return Object.fromEntries(groups) as BundledBackgroundCatalog
}

function imageIsStillReferenced(config: BackgroundConfig, image: string | null) {
  return (
    config.wallpaper.image === image ||
    BACKGROUND_SURFACES.some((candidate) => config.surfaces[candidate].image === image)
  )
}

async function removeUnusedManagedImage(
  image: string | null,
  replacement: string,
  config: BackgroundConfig,
  imageDirectory: string,
) {
  if (
    image?.startsWith(`${imageDirectory}${path.sep}`) &&
    image !== replacement &&
    !imageIsStillReferenced(config, image)
  ) {
    await rm(image, { force: true })
  }
}

async function selectBundledBackground(
  input: unknown,
  target: BackgroundImageTarget,
  options: SettingsOptions,
) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {}
  const requestedFile = "file" in source && typeof source.file === "string" ? source.file : ""
  const item = (await bundledBackgroundItems(target, options)).find(
    (candidate) => candidate.file === requestedFile,
  )
  if (!item) throw new Error("The selected bundled background does not exist.")

  const sourcePath = path.join(options.backgroundsRoot || "", target, item.file)
  await imageFileToDataUrl(sourcePath)
  const imageDirectory = path.join(options.dataDirectory || resolveDataDirectory(), "images")
  await mkdir(imageDirectory, { recursive: true, mode: 0o700 })
  const destination = path.join(imageDirectory, bundledBackgroundDestinationName(target, item.file))
  const extension = path.extname(item.file).toLowerCase()
  const temporary = `${destination}.${process.pid}.${Date.now()}.tmp${extension}`
  await copyFile(sourcePath, temporary)
  try {
    await chmod(temporary, 0o600)
    await imageFileToDataUrl(temporary)
    await rename(temporary, destination)
  } catch (error) {
    await rm(temporary, { force: true })
    throw error
  }

  const previous = await readConfig({ dataDirectory: options.dataDirectory })
  const previousImage = configuredImage(previous, target)
  const config = await writeConfig(
    target === "wallpaper"
      ? { ...previous, wallpaper: { ...previous.wallpaper, enabled: true, image: destination } }
      : {
          ...previous,
          surfaces: {
            ...previous.surfaces,
            [target]: { ...previous.surfaces[target], enabled: true, image: destination },
          },
        },
    { dataDirectory: options.dataDirectory },
  )
  await removeUnusedManagedImage(previousImage, destination, config, imageDirectory)
  const application = await syncConfiguredBackground(config, options)
  return { ...(await statePayload(config, options)), application }
}

async function statePayload(config: BackgroundConfig, options: SettingsOptions) {
  return {
    bundledBackgrounds: await bundledBackgroundCatalog(config, options),
    config,
    status: {
      ...(await backgroundStatus(config, options)),
      daemonRunning: Boolean(await readDaemonPid({ dataDirectory: options.dataDirectory })),
    },
  }
}

async function saveAndSync(input: unknown, options: SettingsOptions) {
  const current = await readConfig({ dataDirectory: options.dataDirectory })
  const updates = editableConfig(input)
  const config = await writeConfig(
    {
      ...current,
      ...updates,
      wallpaper: { ...current.wallpaper, ...updates.wallpaper },
      surfaces: {
        main: { ...current.surfaces.main, ...updates.surfaces?.main },
        sidebar: { ...current.surfaces.sidebar, ...updates.surfaces?.sidebar },
      },
    },
    { dataDirectory: options.dataDirectory },
  )
  const application = await syncConfiguredBackground(config, options)
  return { ...(await statePayload(config, options)), application }
}

async function uploadImage(
  request: IncomingMessage,
  imageTarget: BackgroundImageTarget,
  options: SettingsOptions,
) {
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
  const target = path.join(imageDirectory, `background-${imageTarget}-${now}${extension}`)
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
  const previousImage =
    imageTarget === "wallpaper" ? previous.wallpaper.image : previous.surfaces[imageTarget].image
  const config = await writeConfig(
    imageTarget === "wallpaper"
      ? { ...previous, wallpaper: { ...previous.wallpaper, enabled: true, image: target } }
      : {
          ...previous,
          surfaces: {
            ...previous.surfaces,
            [imageTarget]: {
              ...previous.surfaces[imageTarget],
              enabled: true,
              image: target,
            },
          },
        },
    { dataDirectory: options.dataDirectory },
  )
  await removeUnusedManagedImage(previousImage, target, config, imageDirectory)
  const application = await syncConfiguredBackground(config, options)
  return { ...(await statePayload(config, options)), application }
}

function imageTarget(pathname: string): BackgroundImageTarget | undefined {
  if (pathname === "/api/image") return "main"
  if (pathname === "/api/wallpaper/image") return "wallpaper"
  const match = pathname.match(/^\/api\/surfaces\/(main|sidebar)\/image$/)
  return match?.[1] as BackgroundSurface | undefined
}

function bundledBackgroundTarget(pathname: string): BackgroundImageTarget | undefined {
  const match = pathname.match(/^\/api\/bundled-backgrounds\/(wallpaper|main|sidebar)$/)
  return match?.[1] as BackgroundImageTarget | undefined
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
  const backgroundsRoot = options.backgroundsRoot || path.join(uiRoot, "backgrounds")
  const runtimeOptions = { ...options, backgroundsRoot, dataDirectory, uiRoot }
  let idleTimer: ReturnType<typeof setTimeout>

  const armIdleTimer = () => {
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => server.close(), options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS)
    idleTimer.unref()
  }

  const server = http.createServer(async (request, response) => {
    armIdleTimer()
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
      sendJson(response, 403, { error: "Open the settings page from codex-skin settings." })
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

      const requestedImageTarget = imageTarget(url.pathname)
      if (request.method === "GET" && requestedImageTarget) {
        const config = await readConfig({ dataDirectory })
        const image =
          requestedImageTarget === "wallpaper"
            ? config.wallpaper.image
            : config.surfaces[requestedImageTarget].image
        if (!image) {
          response.statusCode = 404
          response.end()
          return
        }
        const extension = path.extname(image).toLowerCase()
        const mediaType =
          [...IMAGE_EXTENSIONS.entries()].find(([, value]) => value === extension)?.[0] ||
          (extension === ".jpeg" ? "image/jpeg" : null)
        if (!mediaType) throw new Error("The configured image type is not supported.")
        response.statusCode = 200
        response.setHeader("content-type", mediaType)
        response.end(await readFile(image))
        return
      }

      if (request.method === "PUT" && url.pathname === "/api/config") {
        sendJson(response, 200, await saveAndSync(await readJsonBody(request), runtimeOptions))
        return
      }

      const selectedBundledBackground = bundledBackgroundTarget(url.pathname)
      if (request.method === "POST" && selectedBundledBackground) {
        sendJson(
          response,
          200,
          await selectBundledBackground(
            await readJsonBody(request),
            selectedBundledBackground,
            runtimeOptions,
          ),
        )
        return
      }

      if (request.method === "POST" && requestedImageTarget) {
        sendJson(response, 200, await uploadImage(request, requestedImageTarget, runtimeOptions))
        return
      }

      if (request.method === "POST" && url.pathname === "/api/start") {
        const input = await readJsonBody(request)
        const restartRunningCodex =
          typeof input === "object" &&
          input !== null &&
          "restartRunningCodex" in input &&
          input.restartRunningCodex === true
        const config = await readConfig({ dataDirectory })
        if (restartRunningCodex) {
          const payload = await statePayload(config, runtimeOptions)
          response.once("finish", () => {
            try {
              const startRestartWorker =
                options.startBackgroundRestartWorkerImpl || startBackgroundRestartWorker
              startRestartWorker({ entryPath: options.entryPath })
            } catch (error) {
              console.error("Unable to hand off the Codex restart:", error)
            }
          })
          sendJson(response, 202, {
            ...payload,
            application: { applied: false, mode: "restarting" },
          })
          return
        }
        const application = await (
          options.startConfiguredBackgroundImpl || startConfiguredBackground
        )(config, runtimeOptions)
        const activeConfig = await readConfig({ dataDirectory })
        sendJson(response, 200, {
          ...(await statePayload(activeConfig, runtimeOptions)),
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
  armIdleTimer()
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
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  const processIdentity = await (options.inspectProcessImpl || inspectProcess)(process.pid)
  if (!processIdentity) throw new Error("Unable to verify the settings server process.")
  const identity = { ...processIdentity, pid: process.pid }
  if (!(await claimSettingsServerLock(identity, options))) return

  const statePath = runtimePaths({ dataDirectory }).state
  try {
    const instance = await listenSettingsServer({ ...options, dataDirectory })
    await writeFile(
      statePath,
      `${JSON.stringify({ ...instance.state, process: processIdentity }, null, 2)}\n`,
      { mode: 0o600 },
    )

    const close = () => instance.server.close()
    process.once("SIGTERM", close)
    process.once("SIGINT", close)
    await new Promise<void>((resolve) => instance.server.once("close", resolve))
  } finally {
    const current = await readSettingsServerIdentity(statePath)
    if (current?.pid === process.pid) await unlink(statePath).catch(() => undefined)
    await releaseSettingsServerLock(process.pid, options)
  }
}

export async function readSettingsServerState(
  options: SettingsProcessOptions = {},
): Promise<SettingsServerState | null> {
  try {
    const state = JSON.parse(
      await readFile(runtimePaths(options).state, "utf8"),
    ) as SettingsServerState
    const actual = await (options.inspectProcessImpl || inspectProcess)(state.pid)
    return settingsServerIdentityMatches(state, actual) ? state : null
  } catch (error) {
    if (errorCode(error) === "ENOENT" || error instanceof SyntaxError) return null
    throw error
  }
}

/** Stops the detached settings server without signaling an unrelated recycled PID. */
export async function stopSettingsServer(options: SettingsProcessOptions = {}) {
  const paths = runtimePaths(options)
  const [state, lockOwner, discovered] = await Promise.all([
    readSettingsServerState(options),
    readVerifiedSettingsServerIdentity(paths.lock, options),
    discoveredSettingsServerPids(options),
  ])
  const pids = [...discovered, ...(state ? [state.pid] : []), ...(lockOwner ? [lockOwner.pid] : [])]
  await terminateProcesses(pids, options)
  await Promise.all([rm(paths.lock, { force: true }), rm(paths.state, { force: true })])
  return state?.pid || lockOwner?.pid || pids[0] || null
}

export async function ensureSettingsServer({
  entryPath,
  spawnImpl = spawn as SpawnImplementation,
  ...options
}: SettingsOptions) {
  const paths = runtimePaths(options)
  const [existing, lockOwner, discovered] = await Promise.all([
    readSettingsServerState(options),
    readVerifiedSettingsServerIdentity(paths.lock, options),
    discoveredSettingsServerPids(options),
  ])
  if (existing && lockOwner?.pid === existing.pid) {
    await terminateProcesses(
      discovered.filter((pid) => pid !== existing.pid),
      options,
    )
    return {
      ...existing,
      started: false,
      url: `http://127.0.0.1:${existing.port}/?token=${existing.token}`,
    }
  }
  await terminateProcesses(
    [...discovered, ...(existing ? [existing.pid] : []), ...(lockOwner ? [lockOwner.pid] : [])],
    options,
  )
  await Promise.all([rm(paths.lock, { force: true }), rm(paths.state, { force: true })])

  const child = spawnImpl(process.execPath, [entryPath, "settings-server"], {
    detached: true,
    env: {
      ...process.env,
      CODEX_SKIN_HOME: options.dataDirectory || resolveDataDirectory(options.env),
    },
    stdio: "ignore",
  })
  child.unref()
  if (!child.pid) throw new Error("Unable to start the settings server.")

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const [state, registeredLock] = await Promise.all([
      readSettingsServerState(options),
      readVerifiedSettingsServerIdentity(paths.lock, options),
    ])
    if (state && registeredLock?.pid === state.pid) {
      return {
        ...state,
        started: state.pid === child.pid,
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
