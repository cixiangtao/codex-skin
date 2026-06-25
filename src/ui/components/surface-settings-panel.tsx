import type { FormEvent } from "react"

import { axisAnchor } from "../../shared/background-position.ts"
import type {
  BackgroundSurface,
  BundledBackgroundGroup,
  BusyAction,
  SurfaceBackgroundConfig,
} from "../types.ts"
import { BackgroundImagePicker } from "./background-image-picker.tsx"
import { RangeField } from "./range-field.tsx"

interface SurfaceSettingsPanelProps {
  actionNote: string
  advice: { opaque: boolean; text: string }
  busyAction: BusyAction
  bundledBackgrounds: BundledBackgroundGroup
  canStartBackground: boolean
  config: SurfaceBackgroundConfig
  imageLabel: string
  imageSource?: string
  label: string
  onChooseImage: () => void
  onConfigChange: <Key extends keyof SurfaceBackgroundConfig>(
    key: Key,
    value: SurfaceBackgroundConfig[Key],
  ) => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onPositionChange: (x: number, y: number) => void
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onSelectBundledBackground: (file: string) => Promise<void>
  onStart: () => Promise<void>
  surface: BackgroundSurface
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

/** Renders the complete, reusable settings UI for one background surface. */
export function SurfaceSettingsPanel({
  actionNote,
  advice,
  busyAction,
  bundledBackgrounds,
  canStartBackground,
  config,
  imageLabel,
  imageSource,
  label,
  onChooseImage,
  onConfigChange,
  onEnabledChange,
  onPositionChange,
  onSave,
  onSelectBundledBackground,
  onStart,
  surface,
}: SurfaceSettingsPanelProps) {
  return (
    <section aria-label={`${label}布景设置`}>
      <div className="surface-heading">
        <div>
          <strong>{label}布景</strong>
          <small>参数与其他分区互不影响</small>
        </div>
        <label className="power-switch is-compact">
          <input
            name={`${surface}Enabled`}
            type="checkbox"
            checked={config.enabled}
            disabled={busyAction !== null}
            onChange={(event) => void onEnabledChange(event.currentTarget.checked)}
          />
          <span aria-hidden="true">
            <i />
          </span>
          <b>显示</b>
        </label>
      </div>

      <BackgroundImagePicker
        advice={{
          warning: imageSource ? advice.opaque : false,
          text: imageSource ? advice.text : "支持 PNG、JPEG、WebP、GIF、AVIF，最大 25 MB",
        }}
        busyAction={busyAction}
        bundledBackgrounds={bundledBackgrounds}
        bundledLabel="内置人物"
        imageLabel={imageLabel}
        imageSource={imageSource}
        onChooseImage={onChooseImage}
        onSelectBundledBackground={onSelectBundledBackground}
        title={`${label}人物图片`}
        uploadHint="也可以拖入左侧预览区"
        uploadLabel={imageSource ? "更换本地图片" : "上传本地图片"}
        variant="illustration"
      />

      <form onSubmit={(event) => void onSave(event)}>
        <fieldset className="control-group">
          <legend>外观</legend>
          <RangeField
            label="人物大小"
            name="illustrationSize"
            min={80}
            max={1200}
            step={10}
            value={config.illustrationSize}
            output={`${Math.round(config.illustrationSize)} px`}
            onChange={(value) => onConfigChange("illustrationSize", value)}
          />
          <RangeField
            label="透明度"
            name="illustrationOpacity"
            min={0}
            max={1}
            step={0.01}
            value={config.illustrationOpacity}
            output={`${Math.round(config.illustrationOpacity * 100)}%`}
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
              value={config.illustrationBlur}
              output={`${Math.round(config.illustrationBlur)} px`}
              onChange={(value) => onConfigChange("illustrationBlur", value)}
            />
            <div className="advanced-position">
              <span>精确位置</span>
              <div className="position-map" aria-label={`${label}人物预设位置`}>
                {positionPresets.map((preset) => {
                  const active =
                    Math.abs(preset.x - config.illustrationX) <= 2 &&
                    Math.abs(preset.y - config.illustrationY) <= 2
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
                  value={config.illustrationX}
                  output={positionOutput(config.illustrationX, "左", "右")}
                  onChange={(value) => onConfigChange("illustrationX", value)}
                />
                <RangeField
                  label="纵向 Y"
                  name="illustrationY"
                  min={0}
                  max={100}
                  step={1}
                  value={config.illustrationY}
                  output={positionOutput(config.illustrationY, "上", "下")}
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
          {canStartBackground && (
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
    </section>
  )
}
