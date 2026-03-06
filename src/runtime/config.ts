import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type {
  BackgroundConfig,
  BackgroundConfigLike,
  ConfigOptions,
  DataDirectoryOptions,
} from "./types.ts"
import { errorCode } from "./types.ts"

export const DEFAULT_CONFIG = Object.freeze({
  version: 2,
  enabled: true,
  image: null,
  illustrationSize: 360,
  illustrationX: 82,
  illustrationY: 76,
  illustrationBlur: 0,
  illustrationOpacity: 1,
  port: 9229,
  pollIntervalMs: 3000,
  appPath: "/Applications/ChatGPT.app",
} satisfies BackgroundConfig)

export function resolveDataDirectory(env: NodeJS.ProcessEnv = process.env) {
  if (env.CODEX_BACKGROUND_HOME) return path.resolve(env.CODEX_BACKGROUND_HOME)
  if (env.XDG_CONFIG_HOME) {
    return path.join(path.resolve(env.XDG_CONFIG_HOME), "codex-background")
  }
  return path.join(path.resolve(env.HOME || os.homedir()), ".config", "codex-background")
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

export function normalizeConfig(
  input: BackgroundConfigLike | unknown = {},
  options: ConfigOptions = {},
): BackgroundConfig {
  const source: Record<string, unknown> =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {}
  const workingDirectory = options.cwd || process.cwd()
  const image =
    typeof source.image === "string" && source.image.trim()
      ? path.resolve(workingDirectory, source.image.trim())
      : null
  const appPath =
    typeof source.appPath === "string" && source.appPath.trim()
      ? path.resolve(workingDirectory, source.appPath.trim())
      : DEFAULT_CONFIG.appPath
  const requestedPort = Math.round(Number(source.port))

  return {
    version: 2,
    enabled: source.enabled === undefined ? DEFAULT_CONFIG.enabled : Boolean(source.enabled),
    image,
    illustrationSize: Math.round(
      clampNumber(source.illustrationSize, 80, 1200, DEFAULT_CONFIG.illustrationSize),
    ),
    illustrationX: clampNumber(source.illustrationX, 0, 100, DEFAULT_CONFIG.illustrationX),
    illustrationY: clampNumber(source.illustrationY, 0, 100, DEFAULT_CONFIG.illustrationY),
    illustrationBlur: clampNumber(source.illustrationBlur, 0, 30, DEFAULT_CONFIG.illustrationBlur),
    illustrationOpacity: clampNumber(
      source.illustrationOpacity,
      0,
      1,
      DEFAULT_CONFIG.illustrationOpacity,
    ),
    port:
      Number.isInteger(requestedPort) && requestedPort >= 1024 && requestedPort <= 65535
        ? requestedPort
        : DEFAULT_CONFIG.port,
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
    if (errorCode(error) === "ENOENT") return { ...DEFAULT_CONFIG }
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${configPath}: ${error.message}`, { cause: error })
    }
    throw error
  }
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
