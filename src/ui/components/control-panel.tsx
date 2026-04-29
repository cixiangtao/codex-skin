import type { FormEvent } from "react"

import { axisAnchor } from "../../shared/background-position.ts"
import { backgroundSurfaces } from "../model.ts"
import type {
  BackgroundConfig,
  BackgroundStatus,
  BackgroundSurface,
  BusyAction,
  SurfaceBackgroundConfig,
} from "../types.ts"
import { RangeField } from "./range-field.tsx"

interface ControlPanelProps {
  actionNote: string
  activeSurface: BackgroundSurface
  advice: { opaque: boolean; text: string }
  busyAction: BusyAction
  config: BackgroundConfig
  imageLabel: string
  imageSource?: string
  onActiveSurfaceChange: (surface: BackgroundSurface) => void
  onChooseImage: () => void
  onConfigChange: <Key extends keyof SurfaceBackgroundConfig>(
    key: Key,
    value: SurfaceBackgroundConfig[Key],
  ) => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onPositionChange: (x: number, y: number) => void
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onStart: () => Promise<void>
  onSurfaceEnabledChange: (enabled: boolean) => Promise<void>
  status: BackgroundStatus | null
  surfaceConfig: SurfaceBackgroundConfig
}

const positionPresets = [
  { label: "左上", x: 18, y: 20 },
  { label: "顶部", x: 50, y: 20 },
  { label: "右上", x: 82, y: 20 },
  { label: "左侧", x: 18, y: 50 },
  { label: "居中", x: 50, y: 50 },
  { label: "右侧", x: 82, y: 50 },
  { label: "左下", x: 18, y: 80 },
  { label: "底部", x: 50, y: 80 },
  { label: "右下", x: 82, y: 80 },
] as const

function positionOutput(position: number, startLabel: string, endLabel: string) {
  const anchor = axisAnchor(position)
  if (anchor.edge === "center") return "中心"
  return `${anchor.edge === "start" ? startLabel : endLabel} ${Math.round(anchor.offset)}%`
}

/** Renders independent controls for the selected Codex surface. */
export function ControlPanel({
  actionNote,
  activeSurface,
  advice,
  busyAction,
  config,
  imageLabel,
  imageSource,
  onActiveSurfaceChange,
  onChooseImage,
  onConfigChange,
  onEnabledChange,
  onPositionChange,
  onSave,
  onStart,
  onSurfaceEnabledChange,
  status,
  surfaceConfig,
}: ControlPanelProps) {
  const showStartAction = Boolean(config.enabled && status?.imageReadable && !status.cdpAvailable)
  const surfaceLabel = activeSurface === "main" ? "主面板" : "侧边栏"

  return (
    <aside className="control-panel" aria-labelledby="controlsTitle">
      <div className="flex items-center justify-between gap-5">
        <h2 id="controlsTitle" className="font-display text-[30px] leading-none">
          背景设置
        </h2>
        <label className="power-switch">
          <input
            name="enabled"
            type="checkbox"
            checked={config.enabled}
            disabled={busyAction !== null}
            onChange={(event) => void onEnabledChange(event.currentTarget.checked)}
          />
          <span aria-hidden="true">
            <i />
          </span>
          <b>总开关</b>
        </label>
      </div>

      <div className="surface-tabs" role="tablist" aria-label="背景分区">
        {backgroundSurfaces.map((surface) => {
          const surfaceState = config.surfaces[surface.value]
          const active = activeSurface === surface.value
          return (
            <button
              key={surface.value}
              className={active ? "is-active" : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onActiveSurfaceChange(surface.value)}
            >
              <span>{surface.label}</span>
              <i
                className={surfaceState.enabled && surfaceState.image ? "is-configured" : undefined}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <div className="surface-heading">
        <div>
          <strong>{surfaceLabel}布景</strong>
          <small>参数与其他分区互不影响</small>
        </div>
        <label className="power-switch is-compact">
          <input
            name={`${activeSurface}Enabled`}
            type="checkbox"
            checked={surfaceConfig.enabled}
            disabled={busyAction !== null}
            onChange={(event) => void onSurfaceEnabledChange(event.currentTarget.checked)}
          />
          <span aria-hidden="true">
            <i />
          </span>
          <b>显示</b>
        </label>
      </div>

      <section className="image-setting" aria-labelledby="imageSettingTitle">
        <div className="image-setting-heading">
          <h3 id="imageSettingTitle">{surfaceLabel}人物图片</h3>
          <span>选择后立即应用</span>
        </div>
        <div className="image-setting-preview">
          <div className={`image-thumbnail${imageSource ? "" : " is-empty"}`} aria-hidden="true">
            {imageSource ? (
              <img src={imageSource} alt="" width="56" height="56" />
            ) : (
              <span>＋</span>
            )}
          </div>
          <div className="image-setting-copy min-w-0">
            <strong title={surfaceConfig.image || ""}>{imageLabel}</strong>
            <small className={advice.opaque ? "is-warning" : undefined}>
              {imageSource ? advice.text : "支持 PNG、JPEG、WebP、GIF、AVIF，最大 25 MB"}
            </small>
          </div>
        </div>
        <button className="panel-upload-button" type="button" onClick={onChooseImage}>
          <span>{imageSource ? "更换图片" : "选择图片"}</span>
          <small>拖入预览区也会更新当前分区</small>
        </button>
      </section>

      <form onSubmit={(event) => void onSave(event)}>
        <fieldset className="control-group">
          <legend>外观</legend>
          <RangeField
            label="人物大小"
            name="illustrationSize"
            min={80}
            max={1200}
            step={10}
            value={surfaceConfig.illustrationSize}
            output={`${Math.round(surfaceConfig.illustrationSize)} px`}
            onChange={(value) => onConfigChange("illustrationSize", value)}
          />
          <RangeField
            label="透明度"
            name="illustrationOpacity"
            min={0}
            max={1}
            step={0.01}
            value={surfaceConfig.illustrationOpacity}
            output={`${Math.round(surfaceConfig.illustrationOpacity * 100)}%`}
            onChange={(value) => onConfigChange("illustrationOpacity", value)}
          />
        </fieldset>

        <details className="advanced-settings">
          <summary>高级设置</summary>
          <div className="advanced-settings-content">
            <RangeField
              label="边缘柔化"
              name="illustrationBlur"
              min={0}
              max={30}
              step={1}
              value={surfaceConfig.illustrationBlur}
              output={`${Math.round(surfaceConfig.illustrationBlur)} px`}
              onChange={(value) => onConfigChange("illustrationBlur", value)}
            />
            <div className="advanced-position">
              <span>精确位置</span>
              <div className="position-map" aria-label={`${surfaceLabel}人物预设位置`}>
                {positionPresets.map((preset) => {
                  const active =
                    Math.abs(preset.x - surfaceConfig.illustrationX) <= 2 &&
                    Math.abs(preset.y - surfaceConfig.illustrationY) <= 2
                  return (
                    <button
                      key={preset.label}
                      className={active ? "is-active" : undefined}
                      type="button"
                      aria-label={preset.label}
                      aria-pressed={active}
                      onClick={() => onPositionChange(preset.x, preset.y)}
                    />
                  )
                })}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <RangeField
                  label="横向 X"
                  name="illustrationX"
                  min={0}
                  max={100}
                  step={1}
                  value={surfaceConfig.illustrationX}
                  output={positionOutput(surfaceConfig.illustrationX, "左", "右")}
                  onChange={(value) => onConfigChange("illustrationX", value)}
                />
                <RangeField
                  label="纵向 Y"
                  name="illustrationY"
                  min={0}
                  max={100}
                  step={1}
                  value={surfaceConfig.illustrationY}
                  output={positionOutput(surfaceConfig.illustrationY, "上", "下")}
                  onChange={(value) => onConfigChange("illustrationY", value)}
                />
              </div>
            </div>
          </div>
        </details>

        <div className="mt-6 grid gap-3">
          <button className="primary-button" type="submit" disabled={busyAction !== null}>
            <span>{busyAction === "save" ? "正在应用…" : "保存外观参数"}</span>
            <i aria-hidden="true">↗</i>
          </button>
          {showStartAction && (
            <button
              className="secondary-button"
              type="button"
              disabled={busyAction !== null}
              onClick={() => void onStart()}
            >
              <span>{busyAction === "start" ? "正在启动…" : "启动背景模式"}</span>
            </button>
          )}
          {actionNote && <p className="status-note">{actionNote}</p>}
        </div>
      </form>
    </aside>
  )
}
