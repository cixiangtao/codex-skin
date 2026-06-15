import type {
  BackgroundApplication,
  BackgroundConfig,
  BackgroundSurface,
  BackgroundStatus,
  PreviewTheme,
  StatePayload,
} from "./types.ts"

export const acceptedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
])

export const defaultConfig = {
  enabled: false,
  wallpaper: {
    backgroundTransparency: 1,
    enabled: false,
    image: null,
    fit: "cover",
    positionX: 50,
    positionY: 50,
  },
  surfaces: {
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
  },
} as const satisfies StatePayload["config"]

export const backgroundSurfaces = {
  main: { label: "主面板", value: "main" },
  sidebar: { label: "侧边栏", value: "sidebar" },
} as const satisfies Record<BackgroundSurface, { label: string; value: BackgroundSurface }>

export const previewThemes = [
  { label: "系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
] as const satisfies ReadonlyArray<{ label: string; value: PreviewTheme }>

/** Resolves a surface switch together with the global background switch. */
export function backgroundSurfaceIsEnabled(config: BackgroundConfig, surface: BackgroundSurface) {
  return config.enabled && config.surfaces[surface].enabled
}

export const backgroundTabs = [
  { label: "全局背景", value: "wallpaper" },
  { label: "主面板", value: "main" },
  { label: "侧边栏", value: "sidebar" },
] as const

/** Applies the master switch to the global state and both surface switches. */
export function setAllBackgroundsEnabled(config: BackgroundConfig, enabled: boolean) {
  return {
    ...config,
    enabled,
    wallpaper: { ...config.wallpaper, enabled },
    surfaces: {
      main: { ...config.surfaces.main, enabled },
      sidebar: { ...config.surfaces.sidebar, enabled },
    },
  }
}

interface BackgroundPositionDrag {
  illustrationLength: number
  initialPosition: number
  pointerDelta: number
  stageLength: number
}

const MINIMUM_BACKGROUND_TRAVEL_PX = 0.5

/**
 * Converts a physical drag distance back into a CSS background-position percentage.
 *
 * CSS aligns the same percentage point of the image and its container, so its physical
 * offset is `position * (stageLength - illustrationLength)`. The travel becomes negative
 * when an image is larger than the stage; dividing by that signed distance keeps the image
 * following the pointer while preserving the runtime background-position contract.
 */
export function backgroundPositionFromDrag({
  illustrationLength,
  initialPosition,
  pointerDelta,
  stageLength,
}: BackgroundPositionDrag) {
  const availableTravel = stageLength - illustrationLength
  if (Math.abs(availableTravel) < MINIMUM_BACKGROUND_TRAVEL_PX) return initialPosition
  return Math.max(0, Math.min(100, initialPosition + (pointerDelta / availableTravel) * 100))
}

/** Sends an authenticated request to the local Codex Skin settings server. */
export async function api<ResponsePayload>(requestPath: string, options: RequestInit = {}) {
  const response = await fetch(requestPath, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(typeof options.body === "string" ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  })
  const payload = (await response.json().catch(() => ({}))) as ResponsePayload & {
    code?: string
    error?: string
  }
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`)
    Object.assign(error, { code: payload.code, status: response.status })
    throw error
  }
  return payload
}

export function apiErrorCode(error: unknown) {
  return error instanceof Error && "code" in error ? String(error.code) : undefined
}

const apiErrorMessages: Readonly<Record<string, string>> = {
  APP_MISSING: "未找到 Codex 应用，请确认它已安装在“应用程序”文件夹中。",
  BAD_REQUEST: "请求内容无效，请检查后重试。",
  BODY_TOO_LARGE: "上传内容过大，图片不能超过 25 MB。",
  CDP_TIMEOUT: "Codex 已启动，但背景连接未能建立，请重试。",
  DISABLED: "请先启用背景。",
  IMAGE_MISSING: "请先选择一张背景图片。",
  NO_TARGETS: "没有找到可应用背景的 Codex 窗口，请打开 Codex 后重试。",
  PORT_IN_USE: "背景连接端口正被其他程序占用，请重试。",
  RESTART_REQUIRED: "Codex 需要重启后才能启用背景。",
}

/** Converts API and browser failures into concise user-facing Chinese copy. */
export function describeError(error: unknown) {
  const code = apiErrorCode(error)
  if (code && apiErrorMessages[code]) return apiErrorMessages[code]
  if (error instanceof Error && "status" in error) {
    if (error.status === 403) return "设置会话已失效，请通过 Codex Skin 重新打开此页面。"
    if (error.status === 404) return "请求的设置功能不存在，请重新打开页面后再试。"
  }
  if (error instanceof TypeError) return "无法连接本地设置服务，请重新打开 Codex Skin。"
  return error instanceof Error ? error.message : String(error)
}

export function describeApplication(application?: BackgroundApplication) {
  if (!application) return "背景设置已保存。"
  if (application.mode === "injected") {
    return `背景已应用到 ${application.targets ?? 0} 个 Codex 窗口。`
  }
  if (application.mode === "started") {
    return `背景模式已启动，并应用到 ${application.targets ?? 0} 个 Codex 窗口。`
  }
  if (application.mode === "removed") return "背景已关闭，Codex 原生界面保持不变。"
  if (application.reason === "cdp-unavailable") {
    return "背景设置已保存。请正常退出 Codex，保持此页面开启，然后点击“启动背景模式”。"
  }
  if (application.reason === "image-missing") return "背景设置已保存，请先选择一张背景图片。"
  return "背景设置已保存。"
}

export function connectionDetails(status: BackgroundStatus | null, failed: boolean) {
  if (failed) return { state: "error", text: "设置服务异常" } as const
  if (!status) return { state: "ready", text: "正在连接本地服务" } as const
  if (!status.imageReadable) return { state: "error", text: "背景图片不可读取" } as const
  if (status.cdpAvailable && status.daemonRunning) {
    return { state: "connected", text: "背景已连接" } as const
  }
  if (status.cdpAvailable) return { state: "ready", text: "Codex 可立即应用" } as const
  return { state: "ready", text: "等待启动背景模式" } as const
}

export function imageAdvice(imagePath: string | null) {
  const extension = imagePath?.split(".").pop()?.toLowerCase()
  const opaque = extension === "jpg" || extension === "jpeg"
  return {
    opaque,
    text: opaque
      ? "当前图片有矩形底；人物插图建议换成透明 PNG / WebP"
      : "透明背景会自然融入 Codex 原生界面",
  }
}
