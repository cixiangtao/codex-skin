export interface BackgroundConfig {
  enabled: boolean
  image: string | null
  illustrationSize: number
  illustrationX: number
  illustrationY: number
  illustrationBlur: number
  illustrationOpacity: number
}

export interface BackgroundStatus {
  cdpAvailable: boolean
  daemonRunning: boolean
  imageReadable: boolean
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

export type BusyAction = "save" | "start" | "toggle" | null
export type PreviewTheme = "system" | "light" | "dark"
export type RangeKey =
  | "illustrationSize"
  | "illustrationBlur"
  | "illustrationOpacity"
  | "illustrationX"
  | "illustrationY"
