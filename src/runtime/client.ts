import * as macos from "./macos.ts"
import type { CdpPortInspection, SpawnImplementation } from "./types.ts"

/** Host adapter for client identity, lifecycle, and CDP process ownership. */
export interface CodexClientPlatformAdapter {
  appExecutableExists(appPath: string): Promise<boolean>
  findAvailableCdpPort(preferredPort: number): Promise<number>
  findCodexProcessId(appPath: string): Promise<number | null>
  inspectCdpPort(appPath: string, port: number): Promise<CdpPortInspection>
  isCodexRunning(appPath: string): Promise<boolean>
  launchCodex(options: {
    appPath: string
    port: number
    spawnImpl?: SpawnImplementation
  }): Promise<number | undefined>
  quitCodex(): Promise<void>
  resolveAppExecutable(appPath: string): Promise<string>
  waitForCodexExit(appPath: string): Promise<void>
}

const clientPlatforms = {
  darwin: macos,
} as const satisfies Partial<Record<NodeJS.Platform, CodexClientPlatformAdapter>>

/**
 * Returns the host-specific Codex client adapter without loading platform concerns into services.
 *
 * @throws When the current operating system does not have a runtime adapter yet.
 */
export function codexClientPlatform(
  platform: NodeJS.Platform = process.platform,
): CodexClientPlatformAdapter {
  const adapter = clientPlatforms[platform as keyof typeof clientPlatforms]
  if (adapter) return adapter
  throw new Error(`Codex client runtime is not implemented for ${platform}.`)
}

/** Checks whether the configured client or a host-discovered Codex installation exists. */
export const appExecutableExists = (appPath: string) =>
  codexClientPlatform().appExecutableExists(appPath)

/** Finds a free CDP port using the host operating system's listener inspection. */
export const findAvailableCdpPort = (preferredPort: number) =>
  codexClientPlatform().findAvailableCdpPort(preferredPort)

/** Returns the native Codex application PID based on stable platform identity. */
export const findCodexProcessId = (appPath: string) =>
  codexClientPlatform().findCodexProcessId(appPath)

/** Verifies that every listener on a CDP port belongs to the native Codex process tree. */
export const inspectCdpPort = (appPath: string, port: number) =>
  codexClientPlatform().inspectCdpPort(appPath, port)

/** Checks whether the native Codex client is currently running. */
export const isCodexRunning = (appPath: string) => codexClientPlatform().isCodexRunning(appPath)

/** Launches the native Codex client with loopback CDP enabled. */
export const launchCodex = async (options: {
  appPath: string
  port: number
  spawnImpl?: SpawnImplementation
}) => await codexClientPlatform().launchCodex(options)

/** Requests a normal native-client quit through the host adapter. */
export const quitCodex = () => codexClientPlatform().quitCodex()

/** Resolves the host-specific executable used to launch the native client. */
export const resolveAppExecutable = async (appPath: string) =>
  await codexClientPlatform().resolveAppExecutable(appPath)

/** Waits for the native client to leave the host application registry. */
export const waitForCodexExit = (appPath: string) => codexClientPlatform().waitForCodexExit(appPath)
