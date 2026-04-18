import type {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react"

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
  advice: { opaque: boolean; text: string }
  config: BackgroundConfig
  effectiveTheme: Exclude<PreviewTheme, "system">
  fileDragging: boolean
  illustrationDragging: boolean
  imageLabel: string
  imageSource?: string
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onFinishIllustrationDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void
  onMoveIllustration: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPreviewThemeChange: (theme: PreviewTheme) => void
  onStartIllustrationDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
  placementStageRef: RefObject<HTMLDivElement | null>
  previewTheme: PreviewTheme
}

/** Renders the live Codex mock, theme selector, drag surface, and image picker. */
export function PreviewSection({
  advice,
  config,
  effectiveTheme,
  fileDragging,
  illustrationDragging,
  imageLabel,
  imageSource,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFinishIllustrationDrag,
  onImageChange,
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
    <section aria-labelledby="pageTitle" className="min-w-0">
      <div className="mb-7 grid gap-5 xl:grid-cols-[1fr_270px] xl:items-end">
        <div>
          <p className="eyebrow">A QUIET CHARACTER IN YOUR WORKSPACE</p>
          <h1 id="pageTitle" className="display-title">
            留一点角色感，
            <br />
            <em>别盖住工作。</em>
          </h1>
        </div>
        <p className="max-w-[270px] text-sm leading-7 text-ink/55">
          保留 Codex 原生颜色和层次，只把透明人物插图放进主工作区。拖动人物即可定位。
        </p>
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
                <span>New task</span>
              </div>
              <p>TODAY</p>
              <span className="mock-line w-4/5" />
              <span className="mock-line w-3/5" />
              <span className="mock-line is-active w-11/12" />
              <p>PROJECTS</p>
              <span className="mock-line w-2/3" />
              <span className="mock-line w-3/4" />
            </aside>

            <div ref={placementStageRef} className="mock-main">
              <div className="stage-grid" aria-hidden="true" />
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
              <div className="mock-header" aria-hidden="true">
                <span />
                <i />
              </div>
              <div className="mock-copy" aria-hidden="true">
                <small>YOUR WORKSPACE</small>
                <strong>
                  Keep the focus
                  <br />
                  on the work.
                </strong>
                <p>角色安静地待在背景里，不改变原来的界面层次。</p>
              </div>
              <div className="mock-composer" aria-hidden="true">
                <span>Ask Codex anything</span>
                <i>↑</i>
              </div>
            </div>
          </div>
          <span className="preview-tip">
            <i>✦</i> 拖动插图定位
          </span>
          <span className="frame-index">01 / LIVE PREVIEW</span>
        </div>

        <div className="drop-hint" aria-hidden="true">
          <strong>把人物放在这里</strong>
          <span>支持透明 PNG / WebP</span>
        </div>
      </div>

      <div className="image-meta">
        <div className="min-w-0">
          <span className="meta-label">CURRENT CHARACTER</span>
          <strong title={config.image || ""}>{imageLabel}</strong>
          <small className={advice.opaque ? "is-warning" : undefined}>{advice.text}</small>
        </div>
        <label className="upload-button" htmlFor="imageInput">
          <span>更换人物</span>
          <i aria-hidden="true">↗</i>
          <input
            id="imageInput"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            onChange={onImageChange}
          />
        </label>
      </div>
    </section>
  )
}
