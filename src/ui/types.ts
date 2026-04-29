export type BackgroundSurface = "main" | "sidebar"

export interface SurfaceBackgroundConfig {
  enabled: boolean
  image: string | null
  illustrationSize: number
  illustrationX: number
  illustrationY: number
  illustrationBlur: number
  illustrationOpacity: number
}

export interface BackgroundConfig {
  enabled: boolean
  surfaces: Record<BackgroundSurface, SurfaceBackgroundConfig>
}

export interface BackgroundStatus {
  cdpAvailable: boolean
  daemonRunning: boolean
  imageReadable: boolean
  surfaces: Record<BackgroundSurface, { imageReadable: boolean }>
}

export interface BackgroundApplication {
  mode?: "injected" | "started" | "removed" | "saved"
  reason?: "cdp-unavailable" | "image-missing"
  targets?: number
}

export interface StatePayload {
  application?: BackgroundApplication
  config: BackgroundConfig
  status: BackgroundStatus
}

export type BusyAction = "save" | "start" | "surface-toggle" | "toggle" | null
export type PreviewTheme = "system" | "light" | "dark"
export type RangeKey =
  | "illustrationSize"
  | "illustrationBlur"
  | "illustrationOpacity"
  | "illustrationX"
  | "illustrationY"
