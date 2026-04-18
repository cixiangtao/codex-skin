import type { FormEvent } from "react"

import type { BackgroundConfig, BackgroundStatus, BusyAction } from "../types.ts"
import { RangeField } from "./range-field.tsx"

interface ControlPanelProps {
  actionNote: string
  busyAction: BusyAction
  config: BackgroundConfig
  onConfigChange: <Key extends keyof BackgroundConfig>(
    key: Key,
    value: BackgroundConfig[Key],
  ) => void
  onPositionChange: (x: number, y: number) => void
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onStart: () => Promise<void>
  status: BackgroundStatus | null
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

const sizePresets = [
  { label: "小", value: 220 },
  { label: "中", value: 360 },
  { label: "大", value: 560 },
] as const

/** Renders the controlled placement form and application actions. */
export function ControlPanel({
  actionNote,
  busyAction,
  config,
  onConfigChange,
  onPositionChange,
  onSave,
  onStart,
  status,
}: ControlPanelProps) {
  return (
    <aside className="control-panel" aria-labelledby="controlsTitle">
      <form onSubmit={(event) => void onSave(event)}>
        <div className="mb-5 flex items-start justify-between gap-5">
          <div>
            <p className="eyebrow mb-2">PLACEMENT CONTROLS</p>
            <h2 id="controlsTitle" className="font-display text-[34px] leading-none">
              角色布景
            </h2>
          </div>
          <label className="power-switch">
            <input
              name="enabled"
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => onConfigChange("enabled", event.currentTarget.checked)}
            />
            <span aria-hidden="true">
              <i />
            </span>
            <b>启用</b>
          </label>
        </div>

        <div className="principle-card">
          <span aria-hidden="true">✦</span>
          <p>
            <strong>不会覆盖原背景。</strong>人物只存在于工作区的独立图层。
          </p>
        </div>

        <fieldset className="control-group">
          <legend>人物尺寸与质感</legend>
          <RangeField
            label="插图宽度"
            name="illustrationSize"
            min={80}
            max={1200}
            step={10}
            value={config.illustrationSize}
            output={`${Math.round(config.illustrationSize)} px`}
            onChange={(value) => onConfigChange("illustrationSize", value)}
          />
          <div className="size-presets" aria-label="常用人物大小">
            {sizePresets.map((preset) => (
              <button
                key={preset.value}
                className={config.illustrationSize === preset.value ? "is-active" : undefined}
                type="button"
                aria-pressed={config.illustrationSize === preset.value}
                onClick={() => onConfigChange("illustrationSize", preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <RangeField
            label="人物透明度"
            name="illustrationOpacity"
            min={0}
            max={1}
            step={0.01}
            value={config.illustrationOpacity}
            output={`${Math.round(config.illustrationOpacity * 100)}%`}
            onChange={(value) => onConfigChange("illustrationOpacity", value)}
          />
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
        </fieldset>

        <fieldset className="control-group">
          <legend>人物位置</legend>
          <div className="position-map" aria-label="人物预设位置">
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
              output={`${Math.round(config.illustrationX)}%`}
              onChange={(value) => onConfigChange("illustrationX", value)}
            />
            <RangeField
              label="纵向 Y"
              name="illustrationY"
              min={0}
              max={100}
              step={1}
              value={config.illustrationY}
              output={`${Math.round(config.illustrationY)}%`}
              onChange={(value) => onConfigChange("illustrationY", value)}
            />
          </div>
        </fieldset>

        <div className="mt-6 grid gap-3">
          <button className="primary-button" type="submit" disabled={busyAction !== null}>
            <span>{busyAction === "save" ? "正在摆放" : "保存并应用"}</span>
            <i>↗</i>
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!config.enabled || !status?.imageReadable || busyAction !== null}
            onClick={() => void onStart()}
          >
            <span>{busyAction === "start" ? "正在连接" : "启动背景模式"}</span>
          </button>
          <p className="min-h-8 text-xs leading-5 text-ink/48">{actionNote}</p>
        </div>
      </form>
    </aside>
  )
}
