import { useCallback, useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from "react"

import { ControlPanel } from "./components/control-panel.tsx"
import { PreviewSection } from "./components/preview-section.tsx"
import {
  acceptedImageTypes,
  api,
  apiErrorCode,
  connectionDetails,
  defaultConfig,
  describeApplication,
  describeError,
  imageAdvice,
} from "./model.ts"
import type {
  BackgroundConfig,
  BackgroundStatus,
  BusyAction,
  PreviewTheme,
  StatePayload,
} from "./types.ts"

/** Owns the settings page state and coordinates the local API with the two UI panels. */
export function App() {
  const [config, setConfig] = useState<BackgroundConfig>(defaultConfig)
  const [status, setStatus] = useState<BackgroundStatus | null>(null)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("system")
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  )
  const [imageSource, setImageSource] = useState<string>()
  const [imageLabel, setImageLabel] = useState("尚未选择图片")
  const [actionNote, setActionNote] = useState("")
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [toast, setToast] = useState<{ error: boolean; message: string }>()
  const [fileDragging, setFileDragging] = useState(false)
  const [illustrationDragging, setIllustrationDragging] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const placementStageRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const dragDepthRef = useRef(0)
  const illustrationDraggingRef = useRef(false)

  const notify = useCallback((message: string, error = false) => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ error, message })
    toastTimerRef.current = window.setTimeout(() => setToast(undefined), error ? 6500 : 3500)
  }, [])

  const applyState = useCallback((payload: StatePayload) => {
    setConfig(payload.config)
    setStatus(payload.status)
    setConnectionFailed(false)
    setImageLabel(
      payload.config.image ? payload.config.image.split("/").pop() || "当前图片" : "尚未选择图片",
    )
    setImageSource(payload.config.image ? `/api/image?v=${Date.now()}` : undefined)
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystemTheme = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    mediaQuery.addEventListener("change", updateSystemTheme)
    return () => mediaQuery.removeEventListener("change", updateSystemTheme)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const loadState = async () => {
      try {
        applyState(await api<StatePayload>("/api/state", { signal: controller.signal }))
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        setConnectionFailed(true)
        notify(describeError(error), true)
      }
    }
    void loadState()
    return () => controller.abort()
  }, [applyState, notify])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimerRef.current)
    },
    [],
  )

  const updateConfig = <Key extends keyof BackgroundConfig>(
    key: Key,
    value: BackgroundConfig[Key],
  ) => {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  const updatePosition = (illustrationX: number, illustrationY: number) => {
    setConfig((current) => ({ ...current, illustrationX, illustrationY }))
  }

  const positionFromPointer = (event: ReactPointerEvent<HTMLElement>) => {
    const bounds = placementStageRef.current?.getBoundingClientRect()
    if (!bounds) return
    const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100))
    const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100))
    updatePosition(Math.round(x), Math.round(y))
  }

  const startIllustrationDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    illustrationDraggingRef.current = true
    setIllustrationDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    positionFromPointer(event)
  }

  const moveIllustration = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (illustrationDraggingRef.current) positionFromPointer(event)
  }

  const finishIllustrationDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    illustrationDraggingRef.current = false
    setIllustrationDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyAction("save")
    try {
      const {
        illustrationBlur,
        illustrationOpacity,
        illustrationSize,
        illustrationX,
        illustrationY,
      } = config
      const payload = await api<StatePayload>("/api/config", {
        method: "PUT",
        body: JSON.stringify({
          illustrationBlur,
          illustrationOpacity,
          illustrationSize,
          illustrationX,
          illustrationY,
        }),
      })
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(message)
    } catch (error) {
      notify(describeError(error), true)
    } finally {
      setBusyAction(null)
    }
  }

  const applyEnabled = async (enabled: boolean) => {
    const previousEnabled = config.enabled
    setConfig((current) => ({ ...current, enabled }))
    setBusyAction("toggle")
    try {
      const payload = await api<StatePayload>("/api/config", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      })
      setConfig((current) => ({ ...current, enabled: payload.config.enabled }))
      setStatus(payload.status)
      setConnectionFailed(false)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(message)
    } catch (error) {
      setConfig((current) => ({ ...current, enabled: previousEnabled }))
      notify(describeError(error), true)
    } finally {
      setBusyAction(null)
    }
  }

  const startBackground = async () => {
    setBusyAction("start")
    try {
      const start = (restartRunningCodex = false) =>
        api<StatePayload>("/api/start", {
          method: "POST",
          body: restartRunningCodex ? JSON.stringify({ restartRunningCodex: true }) : undefined,
        })
      let payload: StatePayload
      try {
        payload = await start()
      } catch (error) {
        if (apiErrorCode(error) !== "RESTART_REQUIRED") throw error
        const confirmed = window.confirm(
          "Codex 正在运行，但未启用人物背景连接。是否立即重启 Codex 并启动背景模式？",
        )
        if (!confirmed) {
          throw new Error("Codex Skin 已停止启动。请先完全退出 Codex，再重新运行。")
        }
        payload = await start(true)
      }
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(message)
    } catch (error) {
      const message = describeError(error)
      setActionNote(message)
      notify(message, true)
    } finally {
      setBusyAction(null)
    }
  }

  const uploadImage = async (file?: File) => {
    if (!file) return
    if (file.size === 0) {
      notify("所选图片为空，请重新选择。", true)
      return
    }
    if (!acceptedImageTypes.has(file.type)) {
      notify("请选择 PNG、JPEG、WebP、GIF 或 AVIF 图片。", true)
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      notify("图片不能超过 25 MB。", true)
      return
    }

    const previousImageSource = imageSource
    const previousImageLabel = imageLabel
    const temporaryUrl = URL.createObjectURL(file)
    setImageSource(temporaryUrl)
    setImageLabel(file.name)
    notify("正在把人物插图放入本地布景台……")
    try {
      const payload = await api<StatePayload>("/api/image", {
        method: "POST",
        body: file,
        headers: { "content-type": file.type },
      })
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(`人物插图已更换。${message}`)
    } catch (error) {
      setImageSource(previousImageSource)
      setImageLabel(previousImageLabel)
      notify(describeError(error), true)
    } finally {
      URL.revokeObjectURL(temporaryUrl)
    }
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    void uploadImage(input.files?.[0]).finally(() => {
      input.value = ""
    })
  }

  const chooseImage = () => imageInputRef.current?.click()

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepthRef.current += 1
    setFileDragging(true)
  }

  const handleDragLeave = () => {
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setFileDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setFileDragging(false)
    void uploadImage(event.dataTransfer.files[0])
  }

  const connection = connectionDetails(status, connectionFailed)
  const advice = imageAdvice(imageLabel === "尚未选择图片" ? null : imageLabel)
  const effectiveTheme = previewTheme === "system" ? (systemDark ? "dark" : "light") : previewTheme

  return (
    <>
      <main className="app-shell mx-auto w-full max-w-[1520px] px-5 py-5 sm:px-8 lg:px-12 lg:py-7">
        <header className="flex items-center justify-between border-b border-ink/12 pb-4">
          <a
            className="group flex items-center gap-3 text-inherit no-underline"
            href="/"
            aria-label="Codex Skin 设置首页"
          >
            <span className="logo-mark" aria-hidden="true">
              <i />
            </span>
            <strong className="text-[11px] font-semibold tracking-[0.2em]">CODEX SKIN</strong>
          </a>
          <div className="connection" data-state={connection.state}>
            <i aria-hidden="true" />
            <span>{connection.text}</span>
          </div>
        </header>

        <div className="workspace-layout grid gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 xl:gap-14 xl:py-9">
          <PreviewSection
            config={config}
            effectiveTheme={effectiveTheme}
            fileDragging={fileDragging}
            illustrationDragging={illustrationDragging}
            imageSource={imageSource}
            onChooseImage={chooseImage}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFinishIllustrationDrag={finishIllustrationDrag}
            onMoveIllustration={moveIllustration}
            onPreviewThemeChange={setPreviewTheme}
            onStartIllustrationDrag={startIllustrationDrag}
            placementStageRef={placementStageRef}
            previewTheme={previewTheme}
          />
          <ControlPanel
            actionNote={actionNote}
            advice={advice}
            busyAction={busyAction}
            config={config}
            imageLabel={imageLabel}
            imageSource={imageSource}
            onChooseImage={chooseImage}
            onConfigChange={updateConfig}
            onEnabledChange={applyEnabled}
            onPositionChange={updatePosition}
            onSave={saveSettings}
            onStart={startBackground}
            status={status}
          />
        </div>
      </main>

      <input
        ref={imageInputRef}
        className="visually-hidden-input"
        name="characterImage"
        type="file"
        tabIndex={-1}
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        onChange={handleImageChange}
      />

      <div
        className={`toast${toast ? " is-visible" : ""}${toast?.error ? " is-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast?.message}
      </div>
    </>
  )
}
