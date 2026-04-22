import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react"

import { previewThemes } from "../model.ts"
import type { BackgroundConfig, PreviewTheme } from "../types.ts"

interface PreviewStyle extends CSSProperties {
  "--illustration-blur": string
  "--illustration-opacity": number
  "--illustration-preview-size": string
  "--illustration-translate-x": string
  "--illustration-translate-y": string
  "--illustration-x": string
  "--illustration-y": string
}

interface PreviewSectionProps {
  config: BackgroundConfig
  effectiveTheme: Exclude<PreviewTheme, "system">
  fileDragging: boolean
  illustrationDragging: boolean
  imageSource?: string
  onChooseImage: () => void
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onFinishIllustrationDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
  onMoveIllustration: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPreviewThemeChange: (theme: PreviewTheme) => void
  onStartIllustrationDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
  placementStageRef: RefObject<HTMLDivElement | null>
  previewTheme: PreviewTheme
}

/** Renders the live Codex mock, theme selector, and direct-manipulation surface. */
export function PreviewSection({
  config,
  effectiveTheme,
  fileDragging,
  illustrationDragging,
  imageSource,
  onChooseImage,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFinishIllustrationDrag,
  onMoveIllustration,
  onPreviewThemeChange,
  onStartIllustrationDrag,
  placementStageRef,
  previewTheme,
}: PreviewSectionProps) {
  const previewSize = Math.min(80, Math.max(7, (config.illustrationSize / 1200) * 100))
  const previewStyle: PreviewStyle = {
    "--illustration-blur": `${config.illustrationBlur}px`,
    "--illustration-opacity": config.illustrationOpacity,
    "--illustration-preview-size": `${previewSize}%`,
    "--illustration-translate-x": `${-config.illustrationX}%`,
    "--illustration-translate-y": `${-config.illustrationY}%`,
    "--illustration-x": `${config.illustrationX}%`,
    "--illustration-y": `${config.illustrationY}%`,
  }

  return (
    <section aria-labelledby="pageTitle" className="preview-panel min-w-0">
      <div className="preview-heading">
        <h1 id="pageTitle">实时预览</h1>
        <p>{imageSource ? "拖动人物调整位置" : "选择图片后实时预览"}</p>
      </div>

      <div
        className={`preview-shell${fileDragging ? " is-file-dragging" : ""}`}
        style={previewStyle}
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
            <aside className="mock-sidebar" aria-hidden="true">
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
            </aside>

            <div ref={placementStageRef} className="mock-main">
              <div className="stage-grid" aria-hidden="true" />
              {imageSource ? (
                <div
                  className={`illustration${illustrationDragging ? " is-dragging" : ""}`}
                  role="img"
                  aria-label="当前人物插图预览"
                  onPointerDown={onStartIllustrationDrag}
                  onPointerMove={onMoveIllustration}
                  onPointerUp={onFinishIllustrationDrag}
                  onPointerCancel={onFinishIllustrationDrag}
                >
                  <img src={imageSource} alt="" draggable="false" />
                  <span className="drag-badge">拖动</span>
                </div>
              ) : (
                <div className="preview-empty">
                  <span aria-hidden="true">＋</span>
                  <strong>尚未选择人物图片</strong>
                  <p>选择一张图片，或直接拖入预览区</p>
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
          <strong>松开以使用图片</strong>
        </div>
      </div>
    </section>
  )
}
