import type { ChildProcess, SpawnOptions } from "node:child_process"

export interface BackgroundConfig {
  version: 3
  enabled: boolean
  image: string | null
  illustrationSize: number
  illustrationX: number
  illustrationY: number
  illustrationBlur: number
  illustrationOpacity: number
  port: number
  portMode: "auto" | "fixed"
  pollIntervalMs: number
  appPath: string
}

export type BackgroundConfigInput = Partial<BackgroundConfig> & Record<string, unknown>
export type BackgroundConfigLike = BackgroundConfig | BackgroundConfigInput

export interface DataDirectoryOptions {
  dataDirectory?: string
  env?: NodeJS.ProcessEnv
}

export interface ConfigOptions extends DataDirectoryOptions {
  cwd?: string
}

export type SpawnImplementation = (
  command: string,
  args: string[],
  options?: SpawnOptions,
) => ChildProcess

export interface CdpTarget {
  id?: string
  title?: string
  type?: string
  url?: string
  webSocketDebuggerUrl?: string
}

export interface InjectionResult {
  error?: string
  id?: string
  ok: boolean
  title?: string
  url?: string
}

export interface BackgroundApplication {
  applied: boolean
  daemon?: { pid: number } & Record<string, unknown>
  mode: "injected" | "removed" | "saved" | "started"
  pid?: number | null
  port?: number
  reason?: "cdp-unavailable" | "image-missing"
  targets?: number
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export const errorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined
