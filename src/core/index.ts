export {
  DEFAULT_CONFIG,
  DEFAULT_SURFACE_CONFIGS,
  DEFAULT_WALLPAPER_CONFIG,
  INITIAL_CONFIG,
  configuredBackgroundImages,
  configuredBackgroundSurfaces,
  normalizeConfig,
} from "../runtime/config.ts"
export { buildBackgroundCss } from "../runtime/css.ts"
export { BackgroundStateError } from "../runtime/background-service.ts"
export type {
  BackgroundLifecycleAdapter,
  BackgroundServiceOptions,
} from "../runtime/background-service.ts"
export type {
  BackgroundApplication,
  BackgroundConfig,
  BackgroundConfigInput,
  BackgroundConfigLike,
  BackgroundImageTarget,
  BackgroundSurface,
  SurfaceBackgroundConfig,
  WallpaperConfig,
} from "../runtime/types.ts"
export { createCodexSkinCore } from "./runtime.ts"
export type { CodexSkinCore, CodexSkinCoreOptions, CodexSkinCoreStartOptions } from "./runtime.ts"
