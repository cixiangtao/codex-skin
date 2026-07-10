import type { FormEvent } from "react"

import type { BundledBackgroundGroup, BusyAction, WallpaperConfig } from "../types.ts"
import { BackgroundImagePicker } from "./background-image-picker.tsx"
import { RangeField } from "./range-field.tsx"
import { SettingsPanelLayout } from "./settings-panel-layout.tsx"

interface WallpaperSettingsPanelProps {
  actionNote: string
  busyAction: BusyAction
  bundledBackgrounds: BundledBackgroundGroup
  canStartBackground: boolean
  config: WallpaperConfig
  imageLabel: string
  imageSource?: string
  onChooseImage: () => void
  onConfigChange: <Key extends keyof WallpaperConfig>(key: Key, value: WallpaperConfig[Key]) => void
  onEnabledChange: (enabled: boolean) => Promise<void>
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onSelectBundledBackground: (file: string) => Promise<void>
  onStart: () => Promise<void>
}

/** Renders the settings for the single window-wide wallpaper layer. */
export function WallpaperSettingsPanel({
  actionNote,
  busyAction,
  bundledBackgrounds,
  canStartBackground,
  config,
  imageLabel,
  imageSource,
  onChooseImage,
  onConfigChange,
  onEnabledChange,
  onSave,
  onSelectBundledBackground,
  onStart,
}: WallpaperSettingsPanelProps) {
  return (
    <SettingsPanelLayout
      actionNote={actionNote}
      ariaLabel="全局背景设置"
      busyAction={busyAction}
      canStartBackground={canStartBackground}
      description="位于 Codex 内容面板下方"
      enabled={config.enabled}
      enabledName="wallpaperEnabled"
      label="全局背景"
      onEnabledChange={onEnabledChange}
      onSave={onSave}
      onStart={onStart}
      saveLabel="保存壁纸参数"
    >
      <BackgroundImagePicker
        advice={{ text: "支持 PNG、JPEG、WebP、GIF、AVIF，最大 25 MB" }}
        busyAction={busyAction}
        bundledBackgrounds={bundledBackgrounds}
        bundledLabel="内置壁纸"
        imageLabel={imageLabel}
        imageSource={imageSource}
        onChooseImage={onChooseImage}
        onSelectBundledBackground={onSelectBundledBackground}
        title="壁纸图片"
        uploadHint="也可以拖入左侧预览区"
        uploadLabel={imageSource ? "更换本地壁纸" : "上传本地壁纸"}
        variant="wallpaper"
      />

      <fieldset className="mt-6 border-0 p-0 [&>legend]:mb-3.5 [&>legend]:w-full [&>legend]:border-b [&>legend]:border-ink/10 [&>legend]:pb-[9px] [&>legend]:text-[9px] [&>legend]:font-bold [&>legend]:tracking-[0.16em] [&>legend]:text-ink/40 [&>legend]:uppercase">
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

      <fieldset className="mt-6 border-0 p-0 [&>legend]:mb-3.5 [&>legend]:w-full [&>legend]:border-b [&>legend]:border-ink/10 [&>legend]:pb-[9px] [&>legend]:text-[9px] [&>legend]:font-bold [&>legend]:tracking-[0.16em] [&>legend]:text-ink/40 [&>legend]:uppercase">
        <legend>填充方式</legend>
        <label className="mt-3.5 grid grid-cols-[1fr_auto] items-center gap-3 text-[10px] font-semibold">
          <span>图片适配</span>
          <select
            className="min-w-28 rounded-none border border-ink/14 bg-paper px-[9px] py-[7px] text-ink"
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
    </SettingsPanelLayout>
  )
}
