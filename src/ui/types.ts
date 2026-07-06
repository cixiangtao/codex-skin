export type BackgroundSurface = "main" | "sidebar"
export type BackgroundSettingsTab = "wallpaper" | BackgroundSurface

export interface BundledBackgroundOption {
  file: string
  label: string
  url: string
}

export interface BundledBackgroundGroup {
  items: BundledBackgroundOption[]
  selected: string | null
}

export type BundledBackgroundCatalog = Record<BackgroundSettingsTab, BundledBackgroundGroup>

export interface SurfaceBackgroundConfig {
  enabled: boolean
  image: string | null
  illustrationSize: number
  illustrationX: number
  illustrationY: number
  illustrationBlur: number
  illustrationOpacity: number
}

export interface WallpaperConfig {
  backgroundTransparency: number
  enabled: boolean
  image: string | null
  fit: "contain" | "cover"
  positionX: number
  positionY: number
}

export interface BackgroundConfig {
  enabled: boolean
  wallpaper: WallpaperConfig
  surfaces: Record<BackgroundSurface, SurfaceBackgroundConfig>
}

export interface BackgroundStatus {
  cdpAvailable: boolean
  daemonRunning: boolean
  imageReadable: boolean
  wallpaper: { imageReadable: boolean }
  surfaces: Record<BackgroundSurface, { imageReadable: boolean }>
}

export interface BackgroundApplication {
  mode?: "injected" | "started" | "removed" | "restarting" | "saved"
  reason?: "cdp-unavailable" | "image-missing"
  targets?: number
}

export interface StatePayload {
  application?: BackgroundApplication
  bundledBackgrounds: BundledBackgroundCatalog
  config: BackgroundConfig
  status: BackgroundStatus
}

export type BusyAction = "image" | "save" | "start" | "surface-toggle" | "toggle" | null
export type PreviewTheme = "system" | "light" | "dark"
export type RangeKey =
  | "backgroundTransparency"
  | "illustrationSize"
  | "illustrationBlur"
  | "illustrationOpacity"
  | "illustrationX"
  | "illustrationY"
