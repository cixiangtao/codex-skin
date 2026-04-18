import type {
  BackgroundApplication,
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
  image: null,
  illustrationSize: 360,
  illustrationX: 82,
  illustrationY: 76,
  illustrationBlur: 0,
  illustrationOpacity: 1,
} as const satisfies StatePayload["config"]

export const previewThemes = [
  { label: "系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
] as const satisfies ReadonlyArray<{ label: string; value: PreviewTheme }>

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

export function describeApplication(application?: BackgroundApplication) {
  if (!application) return "人物布景已保存。"
  if (application.mode === "injected") {
    return `人物布景已应用到 ${application.targets ?? 0} 个 Codex 窗口。`
  }
  if (application.mode === "started") {
    return `背景模式已启动，并应用到 ${application.targets ?? 0} 个 Codex 窗口。`
  }
  if (application.mode === "removed") return "人物背景已关闭，Codex 原生界面保持不变。"
  if (application.reason === "cdp-unavailable") {
    return "布景已保存。请正常退出 Codex，保持此页面开启，然后点击“启动背景模式”。"
  }
  if (application.reason === "image-missing") return "布景已保存，请先选择一张人物插图。"
  return "人物布景已保存。"
}

export function connectionDetails(status: BackgroundStatus | null, failed: boolean) {
  if (failed) return { state: "error", text: "设置服务异常" } as const
  if (!status) return { state: "ready", text: "正在连接本地服务" } as const
  if (!status.imageReadable) return { state: "error", text: "插图不可读取" } as const
  if (status.cdpAvailable && status.daemonRunning) {
    return { state: "connected", text: "人物背景已连接" } as const
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
