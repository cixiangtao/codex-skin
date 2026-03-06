interface BackgroundConfig {
  enabled: boolean
  image: string | null
  illustrationSize: number
  illustrationX: number
  illustrationY: number
  illustrationBlur: number
  illustrationOpacity: number
}

interface BackgroundStatus {
  cdpAvailable: boolean
  daemonRunning: boolean
  imageReadable: boolean
}

interface BackgroundApplication {
  mode?: "injected" | "started" | "removed" | "saved"
  reason?: "cdp-unavailable" | "image-missing"
  targets?: number
}

interface StatePayload {
  application?: BackgroundApplication
  config: BackgroundConfig
  status: BackgroundStatus
}

type RangeId =
  | "illustrationSize"
  | "illustrationBlur"
  | "illustrationOpacity"
  | "illustrationX"
  | "illustrationY"

interface RangeSettings {
  multiplier: number
  suffix: string
}

const requireElement = <ElementType extends Element>(selector: string) => {
  const element = document.querySelector<ElementType>(selector)
  if (!element) throw new Error(`Missing required UI element: ${selector}`)
  return element
}

const form = requireElement<HTMLFormElement>("#settingsForm")
const dropZone = requireElement<HTMLElement>("#dropZone")
const placementStage = requireElement<HTMLElement>("#placementStage")
const illustration = requireElement<HTMLElement>("#illustration")
const imageInput = requireElement<HTMLInputElement>("#imageInput")
const imageName = requireElement<HTMLElement>("#imageName")
const imageAdvice = requireElement<HTMLElement>("#imageAdvice")
const connection = requireElement<HTMLElement>("#connection")
const connectionText = requireElement<HTMLElement>("#connectionText")
const actionNote = requireElement<HTMLElement>("#actionNote")
const saveButton = requireElement<HTMLButtonElement>("#saveButton")
const startButton = requireElement<HTMLButtonElement>("#startButton")
const toast = requireElement<HTMLElement>("#toast")
const positionButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-x][data-y]")]
const sizeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-size]")]

const rangeSettings = {
  illustrationSize: { suffix: " px", multiplier: 1 },
  illustrationBlur: { suffix: " px", multiplier: 1 },
  illustrationOpacity: { suffix: "%", multiplier: 100 },
  illustrationX: { suffix: "%", multiplier: 1 },
  illustrationY: { suffix: "%", multiplier: 1 },
} as const satisfies Record<RangeId, RangeSettings>

const control = <ElementType extends HTMLInputElement>(name: string) => {
  const element = form.elements.namedItem(name)
  if (!(element instanceof HTMLInputElement)) throw new Error(`Missing form control: ${name}`)
  return element as ElementType
}

let toastTimer: number | undefined
let dragDepth = 0
let draggingIllustration = false

async function api<ResponsePayload>(requestPath: string, options: RequestInit = {}) {
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

function notify(message: string, error = false) {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.toggle("is-error", error)
  toast.classList.add("is-visible")
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), error ? 6500 : 3500)
}

function setBusy(button: HTMLButtonElement, busy: boolean, busyText: string) {
  const label = button.querySelector<HTMLElement>("span")
  const target = label || button
  button.dataset.label ||= target.textContent?.trim() || ""
  button.disabled = busy
  target.textContent = busy ? busyText : button.dataset.label
}

function updateRange(id: RangeId) {
  const input = requireElement<HTMLInputElement>(`#${id}`)
  const output = requireElement<HTMLOutputElement>(`#${id}Output`)
  const settings = rangeSettings[id]
  const minimum = Number(input.min)
  const maximum = Number(input.max)
  const value = Number(input.value)
  input.style.setProperty("--range-fill", `${((value - minimum) / (maximum - minimum)) * 100}%`)
  output.value = `${Math.round(value * settings.multiplier)}${settings.suffix}`
}

function updatePresetStates() {
  const x = Number(control("illustrationX").value)
  const y = Number(control("illustrationY").value)
  const size = Number(control("illustrationSize").value)
  for (const button of positionButtons) {
    const active =
      Math.abs(Number(button.dataset.x) - x) <= 2 && Math.abs(Number(button.dataset.y) - y) <= 2
    button.classList.toggle("is-active", active)
    button.setAttribute("aria-pressed", String(active))
  }
  for (const button of sizeButtons) {
    const active = Number(button.dataset.size) === size
    button.classList.toggle("is-active", active)
    button.setAttribute("aria-pressed", String(active))
  }
}

function updatePreview() {
  const size = Number(control("illustrationSize").value)
  const x = Number(control("illustrationX").value)
  const y = Number(control("illustrationY").value)
  const blur = Number(control("illustrationBlur").value)
  const opacity = Number(control("illustrationOpacity").value)
  document.documentElement.style.setProperty(
    "--illustration-preview-size",
    `${Math.min(80, Math.max(7, (size / 1200) * 100))}%`,
  )
  document.documentElement.style.setProperty("--illustration-x", `${x}%`)
  document.documentElement.style.setProperty("--illustration-y", `${y}%`)
  document.documentElement.style.setProperty("--illustration-blur", `${blur}px`)
  document.documentElement.style.setProperty("--illustration-opacity", String(opacity))
  for (const id of Object.keys(rangeSettings) as RangeId[]) updateRange(id)
  updatePresetStates()
}

function renderConnection(status: BackgroundStatus) {
  if (!status.imageReadable) {
    connection.dataset.state = "error"
    connectionText.textContent = "插图不可读取"
  } else if (status.cdpAvailable && status.daemonRunning) {
    connection.dataset.state = "connected"
    connectionText.textContent = "人物背景已连接"
  } else if (status.cdpAvailable) {
    connection.dataset.state = "ready"
    connectionText.textContent = "Codex 可立即应用"
  } else {
    connection.dataset.state = "ready"
    connectionText.textContent = "等待启动背景模式"
  }
}

function updateImageAdvice(imagePath: string | null) {
  const extension = imagePath?.split(".").pop()?.toLowerCase()
  const opaque = extension === "jpg" || extension === "jpeg"
  imageAdvice.classList.toggle("is-warning", opaque)
  imageAdvice.textContent = opaque
    ? "当前图片有矩形底；人物插图建议换成透明 PNG / WebP"
    : "透明背景会自然融入 Codex 原生界面"
}

function renderState({ config, status }: StatePayload) {
  control("enabled").checked = config.enabled
  control("illustrationSize").value = String(config.illustrationSize)
  control("illustrationX").value = String(config.illustrationX)
  control("illustrationY").value = String(config.illustrationY)
  control("illustrationBlur").value = String(config.illustrationBlur)
  control("illustrationOpacity").value = String(config.illustrationOpacity)
  imageName.textContent = config.image
    ? config.image.split("/").pop() || "当前图片"
    : "尚未选择图片"
  imageName.title = config.image || ""
  updateImageAdvice(config.image)
  if (config.image) {
    illustration.style.setProperty("--preview-image", `url("/api/image?v=${Date.now()}")`)
  } else {
    illustration.style.removeProperty("--preview-image")
  }
  renderConnection(status)
  startButton.disabled = !config.enabled || !status.imageReadable
  updatePreview()
}

function configFromForm(): Partial<BackgroundConfig> {
  return {
    enabled: control("enabled").checked,
    illustrationSize: Number(control("illustrationSize").value),
    illustrationX: Number(control("illustrationX").value),
    illustrationY: Number(control("illustrationY").value),
    illustrationBlur: Number(control("illustrationBlur").value),
    illustrationOpacity: Number(control("illustrationOpacity").value),
  }
}

function describeApplication(application?: BackgroundApplication) {
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

async function saveSettings(event: SubmitEvent) {
  event.preventDefault()
  setBusy(saveButton, true, "正在摆放")
  try {
    const payload = await api<StatePayload>("/api/config", {
      method: "PUT",
      body: JSON.stringify(configFromForm()),
    })
    renderState(payload)
    const message = describeApplication(payload.application)
    actionNote.textContent = message
    notify(message)
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), true)
  } finally {
    setBusy(saveButton, false, "正在摆放")
  }
}

async function startBackground() {
  setBusy(startButton, true, "正在连接")
  try {
    const payload = await api<StatePayload>("/api/start", { method: "POST" })
    renderState(payload)
    const message = describeApplication(payload.application)
    actionNote.textContent = message
    notify(message)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    actionNote.textContent = message
    notify(message, true)
  } finally {
    setBusy(startButton, false, "正在连接")
  }
}

async function uploadImage(file?: File) {
  if (!file) return
  const accepted = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]
  if (!accepted.includes(file.type)) {
    notify("请选择 PNG、JPEG、WebP、GIF 或 AVIF 图片。", true)
    return
  }
  if (file.size > 25 * 1024 * 1024) {
    notify("图片不能超过 25 MB。", true)
    return
  }

  const temporaryUrl = URL.createObjectURL(file)
  illustration.style.setProperty("--preview-image", `url("${temporaryUrl}")`)
  imageName.textContent = file.name
  notify("正在把人物插图放入本地布景台……")
  try {
    const payload = await api<StatePayload>("/api/image", {
      method: "POST",
      body: file,
      headers: { "content-type": file.type },
    })
    renderState(payload)
    const message = describeApplication(payload.application)
    actionNote.textContent = message
    notify(`人物插图已更换。${message}`)
  } catch (error) {
    notify(error instanceof Error ? error.message : String(error), true)
  } finally {
    URL.revokeObjectURL(temporaryUrl)
    imageInput.value = ""
  }
}

function positionFromPointer(event: PointerEvent) {
  const bounds = placementStage.getBoundingClientRect()
  const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100))
  const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100))
  control("illustrationX").value = String(Math.round(x))
  control("illustrationY").value = String(Math.round(y))
  updatePreview()
}

illustration.addEventListener("pointerdown", (event) => {
  event.preventDefault()
  draggingIllustration = true
  illustration.classList.add("is-dragging")
  illustration.setPointerCapture(event.pointerId)
  positionFromPointer(event)
})

illustration.addEventListener("pointermove", (event) => {
  if (draggingIllustration) positionFromPointer(event)
})

illustration.addEventListener("pointerup", (event) => {
  draggingIllustration = false
  illustration.classList.remove("is-dragging")
  if (illustration.hasPointerCapture(event.pointerId))
    illustration.releasePointerCapture(event.pointerId)
})

illustration.addEventListener("pointercancel", () => {
  draggingIllustration = false
  illustration.classList.remove("is-dragging")
})

form.addEventListener("submit", saveSettings)
startButton.addEventListener("click", startBackground)
imageInput.addEventListener("change", () => uploadImage(imageInput.files?.[0]))
form.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.type === "range") updatePreview()
})

for (const button of positionButtons) {
  button.addEventListener("click", () => {
    control("illustrationX").value = button.dataset.x || "50"
    control("illustrationY").value = button.dataset.y || "50"
    updatePreview()
  })
}

for (const button of sizeButtons) {
  button.addEventListener("click", () => {
    control("illustrationSize").value = button.dataset.size || "360"
    updatePreview()
  })
}

dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault()
  dragDepth += 1
  dropZone.classList.add("is-file-dragging")
})
dropZone.addEventListener("dragover", (event) => event.preventDefault())
dropZone.addEventListener("dragleave", () => {
  dragDepth -= 1
  if (dragDepth <= 0) {
    dragDepth = 0
    dropZone.classList.remove("is-file-dragging")
  }
})
dropZone.addEventListener("drop", (event) => {
  event.preventDefault()
  dragDepth = 0
  dropZone.classList.remove("is-file-dragging")
  uploadImage(event.dataTransfer?.files[0])
})

api<StatePayload>("/api/state")
  .then(renderState)
  .catch((error: unknown) => {
    connection.dataset.state = "error"
    connectionText.textContent = "设置服务异常"
    notify(error instanceof Error ? error.message : String(error), true)
  })
