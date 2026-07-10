import type { FormEvent } from "react"

import { axisAnchor } from "../../shared/background-position.ts"
import { cn } from "../lib/cn.ts"
import type {
  BackgroundSurface,
  BundledBackgroundGroup,
  BusyAction,
  SurfaceBackgroundConfig,
} from "../types.ts"
import { BackgroundImagePicker } from "./background-image-picker.tsx"
import { RangeField } from "./range-field.tsx"
import { SettingsPanelLayout } from "./settings-panel-layout.tsx"

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
    <SettingsPanelLayout
      actionNote={actionNote}
      ariaLabel={`${label}布景设置`}
      busyAction={busyAction}
      canStartBackground={canStartBackground}
      description="参数与其他分区互不影响"
      enabled={config.enabled}
      enabledName={`${surface}Enabled`}
      label={`${label}布景`}
      onEnabledChange={onEnabledChange}
      onSave={onSave}
      onStart={onStart}
      saveLabel="保存外观参数"
    >
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

      <fieldset className="mt-6 border-0 p-0 [&>legend]:mb-3.5 [&>legend]:w-full [&>legend]:border-b [&>legend]:border-ink/10 [&>legend]:pb-[9px] [&>legend]:text-[9px] [&>legend]:font-bold [&>legend]:tracking-[0.16em] [&>legend]:text-ink/40 [&>legend]:uppercase">
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

      <details className="group mt-[22px] border-y border-ink/10">
        <summary className="flex cursor-pointer list-none items-center justify-between py-[13px] text-[10px] font-semibold text-ink/55 after:text-base after:leading-none after:font-normal after:text-leaf after:content-['+'] group-open:after:content-['−'] [&::-webkit-details-marker]:hidden">
          高级设置
        </summary>
        <div className="pb-[18px]">
          <RangeField
            className="mt-[3px]"
            label="边缘柔化"
            name="illustrationBlur"
            min={0}
            max={30}
            step={1}
            value={config.illustrationBlur}
            output={`${Math.round(config.illustrationBlur)} px`}
            onChange={(value) => onConfigChange("illustrationBlur", value)}
          />
          <div className="mt-[22px]">
            <span className="mb-2 block text-[10px]">精确位置</span>
            <div
              className="grid grid-cols-3 gap-[5px] border border-ink/10 bg-ink/[0.035] p-2"
              aria-label={`${label}人物预设位置`}
            >
              {positionPresets.map((preset) => {
                const active =
                  Math.abs(preset.x - config.illustrationX) <= 2 &&
                  Math.abs(preset.y - config.illustrationY) <= 2
                return (
                  <button
                    key={preset.label}
                    className={cn(
                      "relative h-[25px] border-0 bg-transparent before:absolute before:top-1/2 before:left-1/2 before:size-1.5 before:-translate-1/2 before:rounded-full before:bg-ink/20 before:content-[''] before:transition before:duration-150 hover:before:size-2.5 hover:before:bg-citrus hover:before:shadow-[0_0_0_4px_rgb(240_168_59/0.15)]",
                      active &&
                        "before:size-2.5 before:bg-citrus before:shadow-[0_0_0_4px_rgb(240_168_59/0.15)]",
                    )}
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
    </SettingsPanelLayout>
  )
}
