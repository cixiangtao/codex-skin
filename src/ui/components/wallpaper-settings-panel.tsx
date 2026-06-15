import type { FormEvent } from "react"

import type { BusyAction, WallpaperConfig } from "../types.ts"
import { RangeField } from "./range-field.tsx"

interface WallpaperSettingsPanelProps {
  actionNote: string
  busyAction: BusyAction
  canStartBackground: boolean
  config: WallpaperConfig
  imageLabel: string
  imageSource?: string
  onChooseImage: () => void
  onConfigChange: <Key extends keyof WallpaperConfig>(key: Key, value: WallpaperConfig[Key]) => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onStart: () => Promise<void>
}

/** Renders the settings for the single window-wide wallpaper layer. */
export function WallpaperSettingsPanel({
  actionNote,
  busyAction,
  canStartBackground,
  config,
  imageLabel,
  imageSource,
  onChooseImage,
  onConfigChange,
  onEnabledChange,
  onSave,
  onStart,
}: WallpaperSettingsPanelProps) {
  return (
    <section aria-label="全局背景设置">
      <div className="surface-heading">
        <div>
          <strong>全局背景</strong>
          <small>位于 Codex 内容面板下方</small>
        </div>
        <label className="power-switch is-compact">
          <input
            name="wallpaperEnabled"
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

      <section className="image-setting" aria-labelledby="wallpaperImageSettingTitle">
        <div className="image-setting-heading">
          <h3 id="wallpaperImageSettingTitle">壁纸图片</h3>
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
            <strong title={config.image || ""}>{imageLabel}</strong>
            <small>支持 PNG、JPEG、WebP、GIF、AVIF，最大 25 MB</small>
          </div>
        </div>
        <button className="panel-upload-button" type="button" onClick={onChooseImage}>
          <span>{imageSource ? "更换壁纸" : "选择壁纸"}</span>
          <small>拖入预览区也会更新全局背景</small>
        </button>
      </section>

      <form onSubmit={(event) => void onSave(event)}>
        <fieldset className="control-group">
          <legend>背景层次</legend>
          <RangeField
            label="背景色透明度"
            name="backgroundTransparency"
            min={0}
            max={1}
            step={0.01}
            value={config.backgroundTransparency}
            output={`${Math.round(config.backgroundTransparency * 100)}%`}
            onChange={(value) => onConfigChange("backgroundTransparency", value)}
          />
        </fieldset>

        <fieldset className="control-group">
          <legend>填充方式</legend>
          <label className="select-field">
            <span>图片适配</span>
            <select
              name="wallpaperFit"
              value={config.fit}
              onChange={(event) =>
                onConfigChange("fit", event.currentTarget.value as WallpaperConfig["fit"])
              }
            >
              <option value="cover">覆盖窗口</option>
              <option value="contain">完整显示</option>
            </select>
          </label>
          <RangeField
            label="横向位置"
            name="wallpaperPositionX"
            min={0}
            max={100}
            step={1}
            value={config.positionX}
            output={`${Math.round(config.positionX)}%`}
            onChange={(value) => onConfigChange("positionX", value)}
          />
          <RangeField
            label="纵向位置"
            name="wallpaperPositionY"
            min={0}
            max={100}
            step={1}
            value={config.positionY}
            output={`${Math.round(config.positionY)}%`}
            onChange={(value) => onConfigChange("positionY", value)}
          />
        </fieldset>

        <div className="mt-6 grid gap-3">
          <button className="primary-button" type="submit" disabled={busyAction !== null}>
            <span>{busyAction === "save" ? "正在应用…" : "保存壁纸参数"}</span>
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
