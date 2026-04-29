import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react"

import { axisAnchor } from "../../shared/background-position.ts"
import { backgroundSurfaceIsEnabled, previewThemes } from "../model.ts"
import type {
  BackgroundConfig,
  BackgroundSurface,
  PreviewTheme,
  SurfaceBackgroundConfig,
} from "../types.ts"

interface IllustrationStyle extends CSSProperties {
  "--illustration-blur": string
  "--illustration-opacity": number
  "--illustration-preview-size": string
}

interface PreviewSectionProps {
  activeSurface: BackgroundSurface
  config: BackgroundConfig
  effectiveTheme: Exclude<PreviewTheme, "system">
  fileDragging: boolean
  illustrationDragging?: BackgroundSurface
  imageSources: Record<BackgroundSurface, string | undefined>
  onActiveSurfaceChange: (surface: BackgroundSurface) => void
  onChooseImage: () => void
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onFinishIllustrationDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
  onMoveIllustration: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPreviewThemeChange: (theme: PreviewTheme) => void
  onStartIllustrationDrag: (
    surface: BackgroundSurface,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void
  placementStageRefs: Record<BackgroundSurface, RefObject<HTMLDivElement | null>>
  previewTheme: PreviewTheme
}

interface SurfaceIllustrationProps {
  active: boolean
  config: SurfaceBackgroundConfig
  dragging: boolean
  enabled: boolean
  imageSource?: string
  onFinish: (event: ReactPointerEvent<HTMLDivElement>) => void
  onMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onStart: (surface: BackgroundSurface, event: ReactPointerEvent<HTMLDivElement>) => void
  surface: BackgroundSurface
}

function axisPlacement(position: number, axis: "horizontal" | "vertical") {
  const anchor = axisAnchor(position)
  const start = axis === "horizontal" ? "left" : "top"
  const end = axis === "horizontal" ? "right" : "bottom"
  if (anchor.edge === "start") {
    return { inset: { [start]: `${anchor.offset}%` }, translate: -anchor.offset }
  }
  if (anchor.edge === "end") {
    return { inset: { [end]: `${anchor.offset}%` }, translate: anchor.offset }
  }
  return { inset: { [start]: "50%" }, translate: -50 }
}

function illustrationStyle(
  surface: BackgroundSurface,
  config: SurfaceBackgroundConfig,
): IllustrationStyle {
  const logicalSurfaceWidth = surface === "main" ? 900 : 300
  const previewSize = Math.min(
    260,
    Math.max(7, (config.illustrationSize / logicalSurfaceWidth) * 100),
  )
  const horizontal = axisPlacement(config.illustrationX, "horizontal")
  const vertical = axisPlacement(config.illustrationY, "vertical")
  return {
    ...horizontal.inset,
    ...vertical.inset,
    "--illustration-blur": `${config.illustrationBlur}px`,
    "--illustration-opacity": config.illustrationOpacity,
    "--illustration-preview-size": `${previewSize}%`,
    translate: `${horizontal.translate}% ${vertical.translate}%`,
  }
}

function SurfaceIllustration({
  active,
  config,
  dragging,
  enabled,
  imageSource,
  onFinish,
  onMove,
  onStart,
  surface,
}: SurfaceIllustrationProps) {
  if (!enabled || !imageSource) return null
  const surfaceLabel = surface === "main" ? "主面板" : "侧边栏"
  const classes = ["illustration", active && "is-active", dragging && "is-dragging"]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className={classes}
      style={illustrationStyle(surface, config)}
      role="img"
      aria-label={`${surfaceLabel}人物插图预览`}
      onPointerDown={(event) => onStart(surface, event)}
      onPointerMove={onMove}
      onPointerUp={onFinish}
      onPointerCancel={onFinish}
    >
      <img src={imageSource} alt="" draggable="false" />
      <span className="drag-badge">拖动</span>
    </div>
  )
}

/** Renders both configured Codex surfaces and supports direct manipulation per surface. */
export function PreviewSection({
  activeSurface,
  config,
  effectiveTheme,
  fileDragging,
  illustrationDragging,
  imageSources,
  onActiveSurfaceChange,
  onChooseImage,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFinishIllustrationDrag,
  onMoveIllustration,
  onPreviewThemeChange,
  onStartIllustrationDrag,
  placementStageRefs,
  previewTheme,
}: PreviewSectionProps) {
  const activeLabel = activeSurface === "main" ? "主面板" : "侧边栏"
  const hasVisibleImage = (["main", "sidebar"] as const).some(
    (surface) => backgroundSurfaceIsEnabled(config, surface) && imageSources[surface],
  )
  return (
    <section aria-labelledby="pageTitle" className="preview-panel min-w-0">
      <div className="preview-heading">
        <h1 id="pageTitle">实时预览</h1>
        <p>{hasVisibleImage ? `当前编辑：${activeLabel}` : "选择图片后实时预览"}</p>
      </div>

      <div
        className={`preview-shell${fileDragging ? " is-file-dragging" : ""}`}
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="preview-canvas">
          <div className="preview-theme-switcher" role="group" aria-label="Codex 预览主题">
            {previewThemes.map((theme) => (
              <button
                key={theme.value}
                className={previewTheme === theme.value ? "is-active" : undefined}
                type="button"
                aria-pressed={previewTheme === theme.value}
                onClick={() => onPreviewThemeChange(theme.value)}
              >
                {theme.label}
              </button>
            ))}
          </div>
          <div className="mock-window" data-theme={effectiveTheme}>
            <aside
              ref={placementStageRefs.sidebar}
              className={`mock-sidebar surface-stage${activeSurface === "sidebar" ? " is-active" : ""}`}
              onClick={() => onActiveSurfaceChange("sidebar")}
            >
              <SurfaceIllustration
                active={activeSurface === "sidebar"}
                config={config.surfaces.sidebar}
                dragging={illustrationDragging === "sidebar"}
                enabled={backgroundSurfaceIsEnabled(config, "sidebar")}
                imageSource={imageSources.sidebar}
                onFinish={onFinishIllustrationDrag}
                onMove={onMoveIllustration}
                onStart={onStartIllustrationDrag}
                surface="sidebar"
              />
              <div className="mock-sidebar-content" aria-hidden="true">
                <div className="mock-traffic">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="mock-new">
                  <b>＋</b>
                  <span>新任务</span>
                </div>
                <p>今天</p>
                <span className="mock-line w-4/5" />
                <span className="mock-line w-3/5" />
                <span className="mock-line is-active w-11/12" />
                <p>项目</p>
                <span className="mock-line w-2/3" />
                <span className="mock-line w-3/4" />
              </div>
            </aside>

            <div
              ref={placementStageRefs.main}
              className={`mock-main surface-stage${activeSurface === "main" ? " is-active" : ""}`}
              onClick={() => onActiveSurfaceChange("main")}
            >
              <div className="stage-grid" aria-hidden="true" />
              <SurfaceIllustration
                active={activeSurface === "main"}
                config={config.surfaces.main}
                dragging={illustrationDragging === "main"}
                enabled={backgroundSurfaceIsEnabled(config, "main")}
                imageSource={imageSources.main}
                onFinish={onFinishIllustrationDrag}
                onMove={onMoveIllustration}
                onStart={onStartIllustrationDrag}
                surface="main"
              />
              {!hasVisibleImage && (
                <div className="preview-empty">
                  <span aria-hidden="true">＋</span>
                  <strong>尚未选择人物图片</strong>
                  <p>选择一张图片，或直接拖入当前分区</p>
                  <button type="button" onClick={onChooseImage}>
                    选择人物图片
                  </button>
                </div>
              )}
              <div className="mock-header" aria-hidden="true">
                <span />
                <i />
              </div>
              <div className="mock-composer" aria-hidden="true">
                <span>询问 Codex 任何问题</span>
                <i>↑</i>
              </div>
            </div>
          </div>
        </div>

        <div className="drop-hint" aria-hidden="true">
          <strong>松开以更新{activeLabel}</strong>
        </div>
      </div>
    </section>
  )
}
