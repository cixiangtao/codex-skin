import { useCallback, useEffect, useRef, useState } from "react"
import type { ChangeEvent, DragEvent, FormEvent, PointerEvent as ReactPointerEvent } from "react"

import { ControlPanel } from "./components/control-panel.tsx"
import { PreviewSection } from "./components/preview-section.tsx"
import { SurfaceSettingsPanel } from "./components/surface-settings-panel.tsx"
import {
  acceptedImageTypes,
  api,
  apiErrorCode,
  backgroundPositionFromDrag,
  backgroundSurfaces,
  connectionDetails,
  defaultConfig,
  describeApplication,
  describeError,
  imageAdvice,
  setAllBackgroundsEnabled,
} from "./model.ts"
import type {
  BackgroundConfig,
  BackgroundStatus,
  BackgroundSurface,
  BusyAction,
  PreviewTheme,
  StatePayload,
  SurfaceBackgroundConfig,
} from "./types.ts"

interface IllustrationDragState {
  animationFrame?: number
  illustrationHeight: number
  illustrationWidth: number
  initialX: number
  initialY: number
  pendingPosition?: { x: number; y: number }
  pointerId: number
  pointerX: number
  pointerY: number
  stageHeight: number
  stageWidth: number
  surface: BackgroundSurface
}

type SurfaceValues<Value> = Record<BackgroundSurface, Value>

const emptyImageSources = (): SurfaceValues<string | undefined> => ({
  main: undefined,
  sidebar: undefined,
})

const emptyImageLabels = (): SurfaceValues<string> => ({
  main: "尚未选择图片",
  sidebar: "尚未选择图片",
})

const imageLabel = (image: string | null) =>
  image ? image.split("/").pop() || "当前图片" : "尚未选择图片"

/** Owns the settings page state and coordinates both independent Codex surfaces. */
export function App() {
  const [config, setConfig] = useState<BackgroundConfig>(defaultConfig)
  const [status, setStatus] = useState<BackgroundStatus | null>(null)
  const [connectionFailed, setConnectionFailed] = useState(false)
  const [activeSurface, setActiveSurface] = useState<BackgroundSurface>("main")
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("system")
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  )
  const [imageSources, setImageSources] = useState(emptyImageSources)
  const [imageLabels, setImageLabels] = useState(emptyImageLabels)
  const [actionNote, setActionNote] = useState("")
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const [toast, setToast] = useState<{ error: boolean; message: string }>()
  const [fileDragging, setFileDragging] = useState(false)
  const [illustrationDragging, setIllustrationDragging] = useState<BackgroundSurface>()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageInputSurfaceRef = useRef<BackgroundSurface>("main")
  const mainStageRef = useRef<HTMLDivElement>(null)
  const sidebarStageRef = useRef<HTMLDivElement>(null)
  const toastTimerRef = useRef<number | undefined>(undefined)
  const dragDepthRef = useRef(0)
  const illustrationDragRef = useRef<IllustrationDragState | undefined>(undefined)

  const placementStageRefs = { main: mainStageRef, sidebar: sidebarStageRef }

  const notify = useCallback((message: string, error = false) => {
    window.clearTimeout(toastTimerRef.current)
    setToast({ error, message })
    toastTimerRef.current = window.setTimeout(() => setToast(undefined), error ? 6500 : 3500)
  }, [])

  const applyState = useCallback((payload: StatePayload) => {
    const now = Date.now()
    setConfig(payload.config)
    setStatus(payload.status)
    setConnectionFailed(false)
    setImageLabels({
      main: imageLabel(payload.config.surfaces.main.image),
      sidebar: imageLabel(payload.config.surfaces.sidebar.image),
    })
    setImageSources({
      main: payload.config.surfaces.main.image ? `/api/surfaces/main/image?v=${now}` : undefined,
      sidebar: payload.config.surfaces.sidebar.image
        ? `/api/surfaces/sidebar/image?v=${now}`
        : undefined,
    })
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
      const animationFrame = illustrationDragRef.current?.animationFrame
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame)
    },
    [],
  )

  const updateSurfaceConfig = <Key extends keyof SurfaceBackgroundConfig>(
    surface: BackgroundSurface,
    key: Key,
    value: SurfaceBackgroundConfig[Key],
  ) => {
    setConfig((current) => ({
      ...current,
      surfaces: {
        ...current.surfaces,
        [surface]: { ...current.surfaces[surface], [key]: value },
      },
    }))
  }

  const updatePosition = (
    surface: BackgroundSurface,
    illustrationX: number,
    illustrationY: number,
  ) => {
    setConfig((current) => ({
      ...current,
      surfaces: {
        ...current.surfaces,
        [surface]: { ...current.surfaces[surface], illustrationX, illustrationY },
      },
    }))
  }

  const positionForPointer = (
    drag: IllustrationDragState,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => ({
    x: backgroundPositionFromDrag({
      illustrationLength: drag.illustrationWidth,
      initialPosition: drag.initialX,
      pointerDelta: event.clientX - drag.pointerX,
      stageLength: drag.stageWidth,
    }),
    y: backgroundPositionFromDrag({
      illustrationLength: drag.illustrationHeight,
      initialPosition: drag.initialY,
      pointerDelta: event.clientY - drag.pointerY,
      stageLength: drag.stageHeight,
    }),
  })

  const flushIllustrationPosition = () => {
    const drag = illustrationDragRef.current
    if (!drag) return
    drag.animationFrame = undefined
    const position = drag.pendingPosition
    if (!position) return
    drag.pendingPosition = undefined
    updatePosition(drag.surface, position.x, position.y)
  }

  const startIllustrationDrag = (
    surface: BackgroundSurface,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    const stageBounds = placementStageRefs[surface].current?.getBoundingClientRect()
    if (!stageBounds) return
    const illustrationBounds = event.currentTarget.getBoundingClientRect()
    const surfaceConfig = config.surfaces[surface]
    setActiveSurface(surface)
    illustrationDragRef.current = {
      illustrationHeight: illustrationBounds.height,
      illustrationWidth: illustrationBounds.width,
      initialX: surfaceConfig.illustrationX,
      initialY: surfaceConfig.illustrationY,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      stageHeight: stageBounds.height,
      stageWidth: stageBounds.width,
      surface,
    }
    setIllustrationDragging(surface)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveIllustration = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = illustrationDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    drag.pendingPosition = positionForPointer(drag, event)
    if (drag.animationFrame === undefined) {
      drag.animationFrame = window.requestAnimationFrame(flushIllustrationPosition)
    }
  }

  const finishIllustrationDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = illustrationDragRef.current
    if (drag?.pointerId === event.pointerId) {
      if (drag.animationFrame !== undefined) window.cancelAnimationFrame(drag.animationFrame)
      const position = positionForPointer(drag, event)
      updatePosition(drag.surface, position.x, position.y)
      illustrationDragRef.current = undefined
    }
    setIllustrationDragging(undefined)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyAction("save")
    try {
      const appearanceSettings = (surface: BackgroundSurface) => {
        const {
          illustrationBlur,
          illustrationOpacity,
          illustrationSize,
          illustrationX,
          illustrationY,
        } = config.surfaces[surface]
        return {
          illustrationBlur,
          illustrationOpacity,
          illustrationSize,
          illustrationX,
          illustrationY,
        }
      }
      const payload = await api<StatePayload>("/api/config", {
        method: "PUT",
        body: JSON.stringify({
          surfaces: {
            main: appearanceSettings("main"),
            sidebar: appearanceSettings("sidebar"),
          },
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
    const previousEnabled = {
      global: config.enabled,
      main: config.surfaces.main.enabled,
      sidebar: config.surfaces.sidebar.enabled,
    }
    setConfig((current) => setAllBackgroundsEnabled(current, enabled))
    setBusyAction("toggle")
    try {
      const payload = await api<StatePayload>("/api/config", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      })
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(message)
    } catch (error) {
      setConfig((current) => ({
        ...current,
        enabled: previousEnabled.global,
        surfaces: {
          main: { ...current.surfaces.main, enabled: previousEnabled.main },
          sidebar: { ...current.surfaces.sidebar, enabled: previousEnabled.sidebar },
        },
      }))
      notify(describeError(error), true)
    } finally {
      setBusyAction(null)
    }
  }

  const applySurfaceEnabled = async (surface: BackgroundSurface, enabled: boolean) => {
    const previousEnabled = config.surfaces[surface].enabled
    updateSurfaceConfig(surface, "enabled", enabled)
    setBusyAction("surface-toggle")
    try {
      const payload = await api<StatePayload>("/api/config", {
        method: "PUT",
        body: JSON.stringify({ surfaces: { [surface]: { enabled } } }),
      })
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(message)
    } catch (error) {
      updateSurfaceConfig(surface, "enabled", previousEnabled)
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
          "Codex 正在运行，但未启用人物背景连接。是否立即重启 Codex 并启动背景模式？\n\nCodex 可能会再次询问是否退出，请在 Codex 中确认；本页会一直等到 Codex 完全退出。",
        )
        if (!confirmed) {
          throw new Error("Codex Skin 已停止启动。请先完全退出 Codex，再重新运行。")
        }
        const waitingMessage = "正在等待 Codex 退出，如果 Codex 再次弹出确认，请选择退出……"
        setActionNote(waitingMessage)
        notify(waitingMessage)
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

  const uploadImage = async (surface: BackgroundSurface, file?: File) => {
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

    const previousImageSource = imageSources[surface]
    const previousImageLabel = imageLabels[surface]
    const temporaryUrl = URL.createObjectURL(file)
    setImageSources((current) => ({ ...current, [surface]: temporaryUrl }))
    setImageLabels((current) => ({ ...current, [surface]: file.name }))
    notify(`正在更新${backgroundSurfaces[surface].label}人物插图……`)
    try {
      const payload = await api<StatePayload>(`/api/surfaces/${surface}/image`, {
        method: "POST",
        body: file,
        headers: { "content-type": file.type },
      })
      applyState(payload)
      const message = describeApplication(payload.application)
      setActionNote(message)
      notify(`人物插图已更换。${message}`)
    } catch (error) {
      setImageSources((current) => ({ ...current, [surface]: previousImageSource }))
      setImageLabels((current) => ({ ...current, [surface]: previousImageLabel }))
      notify(describeError(error), true)
    } finally {
      URL.revokeObjectURL(temporaryUrl)
    }
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    void uploadImage(imageInputSurfaceRef.current, input.files?.[0]).finally(() => {
      input.value = ""
    })
  }

  const chooseImage = () => {
    imageInputSurfaceRef.current = activeSurface
    imageInputRef.current?.click()
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
    void uploadImage(activeSurface, event.dataTransfer.files[0])
  }

  const activeConfig = config.surfaces[activeSurface]
  const activeSurfaceLabel = backgroundSurfaces[activeSurface].label
  const canStartBackground = Boolean(
    config.enabled && status?.imageReadable && !status.cdpAvailable,
  )
  const connection = connectionDetails(status, connectionFailed)
  const advice = imageAdvice(
    imageLabels[activeSurface] === "尚未选择图片" ? null : imageLabels[activeSurface],
  )
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
            activeSurface={activeSurface}
            config={config}
            effectiveTheme={effectiveTheme}
            fileDragging={fileDragging}
            illustrationDragging={illustrationDragging}
            imageSources={imageSources}
            onActiveSurfaceChange={setActiveSurface}
            onChooseImage={chooseImage}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onFinishIllustrationDrag={finishIllustrationDrag}
            onMoveIllustration={moveIllustration}
            onPreviewThemeChange={setPreviewTheme}
            onStartIllustrationDrag={startIllustrationDrag}
            placementStageRefs={placementStageRefs}
            previewTheme={previewTheme}
          />
          <ControlPanel
            activeSurface={activeSurface}
            busyAction={busyAction}
            config={config}
            onActiveSurfaceChange={setActiveSurface}
            onEnabledChange={applyEnabled}
          >
            <SurfaceSettingsPanel
              actionNote={actionNote}
              advice={advice}
              busyAction={busyAction}
              canStartBackground={canStartBackground}
              config={activeConfig}
              imageLabel={imageLabels[activeSurface]}
              imageSource={imageSources[activeSurface]}
              label={activeSurfaceLabel}
              onChooseImage={chooseImage}
              onConfigChange={(key, value) => updateSurfaceConfig(activeSurface, key, value)}
              onEnabledChange={(enabled) => applySurfaceEnabled(activeSurface, enabled)}
              onPositionChange={(x, y) => updatePosition(activeSurface, x, y)}
              onSave={saveSettings}
              onStart={startBackground}
              surface={activeSurface}
            />
          </ControlPanel>
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
