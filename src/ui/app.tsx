import { useCallback, useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from "react"

import { ControlPanel } from "./components/control-panel.tsx"
import { PreviewSection } from "./components/preview-section.tsx"
import {
  acceptedImageTypes,
  api,
  connectionDetails,
  defaultConfig,
  describeApplication,
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
  const [actionNote, setActionNote] = useState("配置只保存在这台 Mac 上。")
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [toast, setToast] = useState<{ error: boolean; message: string }>()
  const [fileDragging, setFileDragging] = useState(false)
  const [illustrationDragging, setIllustrationDragging] = useState(false)
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
        notify(error instanceof Error ? error.message : String(error), true)
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
        enabled,
        illustrationBlur,
        illustrationOpacity,
        illustrationSize,
        illustrationX,
        illustrationY,
      } = config
      const payload = await api<StatePayload>("/api/config", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
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
      notify(error instanceof Error ? error.message : String(error), true)
    } finally {
      setBusyAction(null)
    }
  }

  const startBackground = async () => {
    setBusyAction("start")
    try {
      const payload = await api<StatePayload>("/api/start", { method: "POST" })
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setActionNote(message)
      notify(message, true)
    } finally {
      setBusyAction(null)
    }
  }

  const uploadImage = async (file?: File) => {
    if (!file) return
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
      notify(error instanceof Error ? error.message : String(error), true)
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
      <main className="mx-auto min-h-screen w-full max-w-[1680px] px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
        <header className="flex items-center justify-between border-b border-ink/12 pb-5">
          <a
            className="group flex items-center gap-3 text-inherit no-underline"
            href="/"
            aria-label="Codex Skin 设置首页"
          >
            <span className="logo-mark" aria-hidden="true">
              <i />
            </span>
            <span>
              <strong className="block text-[11px] font-semibold tracking-[0.22em]">
                CODEX BACKGROUND
              </strong>
              <small className="mt-1 block text-[9px] tracking-[0.18em] text-ink/45">
                CHARACTER ATELIER
              </small>
            </span>
          </a>
          <div className="connection" data-state={connection.state}>
            <i aria-hidden="true" />
            <span>{connection.text}</span>
          </div>
        </header>

        <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 xl:gap-20 xl:py-12">
          <PreviewSection
            advice={advice}
            config={config}
            effectiveTheme={effectiveTheme}
            fileDragging={fileDragging}
            illustrationDragging={illustrationDragging}
            imageLabel={imageLabel}
            imageSource={imageSource}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFinishIllustrationDrag={finishIllustrationDrag}
            onImageChange={handleImageChange}
            onMoveIllustration={moveIllustration}
            onPreviewThemeChange={setPreviewTheme}
            onStartIllustrationDrag={startIllustrationDrag}
            placementStageRef={placementStageRef}
            previewTheme={previewTheme}
          />
          <ControlPanel
            actionNote={actionNote}
            busyAction={busyAction}
            config={config}
            onConfigChange={updateConfig}
            onPositionChange={updatePosition}
            onSave={saveSettings}
            onStart={startBackground}
            status={status}
          />
        </div>

        <footer className="flex items-center justify-between border-t border-ink/10 pt-5 text-[9px] tracking-[0.16em] text-ink/38">
          <span>LOCAL ONLY · 127.0.0.1</span>
          <span>TRANSPARENT PNG / WEBP WORKS BEST</span>
        </footer>
      </main>

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
