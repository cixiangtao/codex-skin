import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type {
  BackgroundConfig,
  BackgroundConfigLike,
  BackgroundSurface,
  ConfigOptions,
  DataDirectoryOptions,
  SurfaceBackgroundConfig,
  WallpaperConfig,
} from "./types.ts"
import { BACKGROUND_SURFACES, errorCode } from "./types.ts"

export const DEFAULT_SURFACE_CONFIGS = Object.freeze({
  main: {
    enabled: true,
    image: null,
    illustrationSize: 360,
    illustrationX: 82,
    illustrationY: 76,
    illustrationBlur: 0,
    illustrationOpacity: 1,
  },
  sidebar: {
    enabled: false,
    image: null,
    illustrationSize: 240,
    illustrationX: 50,
    illustrationY: 80,
    illustrationBlur: 0,
    illustrationOpacity: 0.24,
  },
} as const satisfies Record<BackgroundSurface, SurfaceBackgroundConfig>)

export const DEFAULT_WALLPAPER_CONFIG = Object.freeze({
  backgroundTransparency: 1,
  enabled: false,
  image: null,
  fit: "cover",
  positionX: 50,
  positionY: 50,
} as const satisfies WallpaperConfig)

export const DEFAULT_CONFIG = Object.freeze({
  version: 6,
  enabled: true,
  wallpaper: DEFAULT_WALLPAPER_CONFIG,
  surfaces: DEFAULT_SURFACE_CONFIGS,
  port: 9229,
  portMode: "auto",
  pollIntervalMs: 3000,
  appPath: "/Applications/ChatGPT.app",
} satisfies BackgroundConfig)

/** First-run state keeps every optional appearance layer disabled until the user opts in. */
export const INITIAL_CONFIG = Object.freeze({
  ...DEFAULT_CONFIG,
  enabled: false,
  wallpaper: { ...DEFAULT_WALLPAPER_CONFIG, enabled: false },
  surfaces: {
    main: { ...DEFAULT_SURFACE_CONFIGS.main, enabled: false },
    sidebar: { ...DEFAULT_SURFACE_CONFIGS.sidebar, enabled: false },
  },
} satisfies BackgroundConfig)

export function resolveDataDirectory(env: NodeJS.ProcessEnv = process.env) {
  if (env.CODEX_SKIN_HOME) return path.resolve(env.CODEX_SKIN_HOME)
  // Keep the pre-rename override working for existing local development setups.
  if (env.CODEX_BACKGROUND_HOME) return path.resolve(env.CODEX_BACKGROUND_HOME)
  if (env.XDG_CONFIG_HOME) {
    return path.join(path.resolve(env.XDG_CONFIG_HOME), "codex-skin")
  }
  return path.join(path.resolve(env.HOME || os.homedir()), ".config", "codex-skin")
}

function normalizeWallpaper(input: unknown, workingDirectory: string): WallpaperConfig {
  const source = objectRecord(input)
  const image =
    typeof source.image === "string" && source.image.trim()
      ? path.resolve(workingDirectory, source.image.trim())
      : null

  return {
    backgroundTransparency: clampNumber(
      source.backgroundTransparency,
      0,
      1,
      DEFAULT_WALLPAPER_CONFIG.backgroundTransparency,
    ),
    enabled:
      source.enabled === undefined ? DEFAULT_WALLPAPER_CONFIG.enabled : Boolean(source.enabled),
    image,
    fit: source.fit === "contain" ? "contain" : DEFAULT_WALLPAPER_CONFIG.fit,
    positionX: clampNumber(source.positionX, 0, 100, DEFAULT_WALLPAPER_CONFIG.positionX),
    positionY: clampNumber(source.positionY, 0, 100, DEFAULT_WALLPAPER_CONFIG.positionY),
  }
}

export function resolveConfigPath(options: DataDirectoryOptions = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env)
  return path.join(dataDirectory, "config.json")
}

function clampNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(maximum, Math.max(minimum, number))
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeSurface(
  input: unknown,
  fallback: SurfaceBackgroundConfig,
  workingDirectory: string,
): SurfaceBackgroundConfig {
  const source = objectRecord(input)
  const image =
    typeof source.image === "string" && source.image.trim()
      ? path.resolve(workingDirectory, source.image.trim())
      : null

  return {
    enabled: source.enabled === undefined ? fallback.enabled : Boolean(source.enabled),
    image,
    illustrationSize: Math.round(
      clampNumber(source.illustrationSize, 80, 1200, fallback.illustrationSize),
    ),
    illustrationX: clampNumber(source.illustrationX, 0, 100, fallback.illustrationX),
    illustrationY: clampNumber(source.illustrationY, 0, 100, fallback.illustrationY),
    illustrationBlur: clampNumber(source.illustrationBlur, 0, 30, fallback.illustrationBlur),
    illustrationOpacity: clampNumber(
      source.illustrationOpacity,
      0,
      1,
      fallback.illustrationOpacity,
    ),
  }
}

function legacyMainSurface(source: Record<string, unknown>) {
  return {
    enabled: true,
    image: source.image,
    illustrationSize: source.illustrationSize,
    illustrationX: source.illustrationX,
    illustrationY: source.illustrationY,
    illustrationBlur: source.illustrationBlur,
    illustrationOpacity: source.illustrationOpacity,
  }
}

export function normalizeConfig(
  input: BackgroundConfigLike | unknown = {},
  options: ConfigOptions = {},
): BackgroundConfig {
  const source = objectRecord(input)
  const workingDirectory = options.cwd || process.cwd()
  const surfaces = objectRecord(source.surfaces)
  const hasStructuredSurfaces = BACKGROUND_SURFACES.some((surface) => surface in surfaces)
  const appPath =
    typeof source.appPath === "string" && source.appPath.trim()
      ? path.resolve(workingDirectory, source.appPath.trim())
      : DEFAULT_CONFIG.appPath
  const requestedPort = Math.round(Number(source.port))
  const validPort =
    Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
  const port = validPort ? requestedPort : DEFAULT_CONFIG.port
  const portMode =
    source.portMode === "auto" || source.portMode === "fixed"
      ? source.portMode
      : validPort && port !== DEFAULT_CONFIG.port
        ? "fixed"
        : DEFAULT_CONFIG.portMode

  return {
    version: 6,
    enabled: source.enabled === undefined ? DEFAULT_CONFIG.enabled : Boolean(source.enabled),
    wallpaper: normalizeWallpaper(source.wallpaper, workingDirectory),
    surfaces: {
      main: normalizeSurface(
        hasStructuredSurfaces ? surfaces.main : legacyMainSurface(source),
        DEFAULT_SURFACE_CONFIGS.main,
        workingDirectory,
      ),
      sidebar: normalizeSurface(
        hasStructuredSurfaces ? surfaces.sidebar : undefined,
        DEFAULT_SURFACE_CONFIGS.sidebar,
        workingDirectory,
      ),
    },
    port,
    portMode,
    pollIntervalMs: Math.round(
      clampNumber(source.pollIntervalMs, 500, 60_000, DEFAULT_CONFIG.pollIntervalMs),
    ),
    appPath,
  }
}

export async function readConfig(options: ConfigOptions = {}) {
  const configPath = resolveConfigPath(options)
  try {
    const raw = JSON.parse(await readFile(configPath, "utf8")) as unknown
    return normalizeConfig(raw, options)
  } catch (error) {
    if (errorCode(error) === "ENOENT") return normalizeConfig(INITIAL_CONFIG, options)
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${error.message}`, { cause: error })
    }
    throw error
  }
}

/** Returns enabled surfaces with a configured image in stable display order. */
export function configuredBackgroundSurfaces(config: BackgroundConfig) {
  return BACKGROUND_SURFACES.filter((surface) => {
    const surfaceConfig = config.surfaces[surface]
    return surfaceConfig.enabled && Boolean(surfaceConfig.image)
  })
}

/** Returns every enabled and configured image path in stable layer order. */
export function configuredBackgroundImages(config: BackgroundConfig) {
  const images: string[] = []
  if (config.wallpaper.enabled && config.wallpaper.image) images.push(config.wallpaper.image)
  for (const surface of configuredBackgroundSurfaces(config)) {
    const image = config.surfaces[surface].image
    if (image) images.push(image)
  }
  return images
}

export async function writeConfig(input: BackgroundConfigLike, options: ConfigOptions = {}) {
  const config = normalizeConfig(input, options)
  const configPath = resolveConfigPath(options)
  const dataDirectory = path.dirname(configPath)
  const now = Date.now()
  const temporaryPath = `${configPath}.${process.pid}.${now}.tmp`
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, configPath)
  return config
}
