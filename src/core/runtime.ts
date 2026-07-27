import {
  backgroundStatus,
  configuredCdpIsReady,
  injectConfiguredBackground,
  startConfiguredBackground,
  syncConfiguredBackground,
} from "../runtime/background-service.ts"
import type { BackgroundServiceOptions } from "../runtime/background-service.ts"
import { buildBackgroundCss } from "../runtime/css.ts"
import { verifyAllTargets } from "../runtime/injector.ts"
import type { TargetVerification } from "../runtime/injector.ts"
import type { BackgroundApplication, BackgroundConfig } from "../runtime/types.ts"

/** Per-launch behavior that is intentionally separate from reusable runtime dependencies. */
export interface CodexSkinCoreStartOptions {
  restartRunningCodex?: boolean
}

/** Reusable background engine consumed by command-line and desktop adapters. */
export interface CodexSkinCore {
  backgroundRunning(): Promise<boolean | undefined>
  configuredCdpIsReady(config: BackgroundConfig): ReturnType<typeof configuredCdpIsReady>
  inject(config: BackgroundConfig): Promise<number>
  start(
    config: BackgroundConfig,
    options?: CodexSkinCoreStartOptions,
  ): Promise<BackgroundApplication>
  status(config: BackgroundConfig): ReturnType<typeof backgroundStatus>
  sync(config: BackgroundConfig): Promise<BackgroundApplication>
  verify(config: BackgroundConfig, options?: { reload?: boolean }): Promise<TargetVerification[]>
}

/** Dependencies and host adapters retained by a reusable core instance. */
export type CodexSkinCoreOptions = Omit<BackgroundServiceOptions, "restartRunningCodex">

/**
 * Creates a reusable Codex Skin engine without depending on a CLI or desktop window.
 *
 * The caller supplies lifecycle behavior once. CLI consumers can provide an entry path for the
 * detached daemon, while desktop clients can provide an in-process `backgroundLifecycle`.
 */
export function createCodexSkinCore(options: CodexSkinCoreOptions = {}): CodexSkinCore {
  return {
    backgroundRunning: async () => await options.backgroundLifecycle?.isRunning?.(),
    configuredCdpIsReady: async (config) => await configuredCdpIsReady(config, options),
    inject: async (config) => await injectConfiguredBackground(config, options),
    start: async (config, startOptions = {}) =>
      await startConfiguredBackground(config, { ...options, ...startOptions }),
    status: async (config) => await backgroundStatus(config, options),
    sync: async (config) => await syncConfiguredBackground(config, options),
    verify: async (config, verifyOptions = {}) =>
      await verifyAllTargets({
        css: await buildBackgroundCss(config),
        port: config.port,
        reload: verifyOptions.reload === true,
      }),
  }
}
