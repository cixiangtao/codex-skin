import type { ReactNode } from "react"

import { cn } from "../lib/cn.ts"
import { backgroundTabs } from "../model.ts"
import type { BackgroundConfig, BackgroundSettingsTab, BusyAction } from "../types.ts"
import { ToggleSwitch } from "./toggle-switch.tsx"

interface ControlPanelProps {
  activeTab: BackgroundSettingsTab
  busyAction: BusyAction
  children: ReactNode
  config: BackgroundConfig
  onActiveTabChange: (tab: BackgroundSettingsTab) => void
  onEnabledChange: (enabled: boolean) => Promise<void>
}

/** Renders the global background controls and composes the selected surface settings. */
export function ControlPanel({
  activeTab,
  busyAction,
  children,
  config,
  onActiveTabChange,
  onEnabledChange,
}: ControlPanelProps) {
  return (
    <aside
      className="static border border-ink/14 bg-paper/80 p-6 shadow-[14px_14px_0_rgb(45_106_79/0.08),0_28px_70px_rgb(59_53_36/0.08)] backdrop-blur-[18px] lg:min-h-0 lg:[scrollbar-gutter:stable] lg:overflow-y-auto lg:overscroll-y-contain"
      aria-labelledby="controlsTitle"
    >
      <div className="flex items-center justify-between gap-5">
        <h2 id="controlsTitle" className="font-display text-[30px] leading-none">
          背景设置
        </h2>
        <ToggleSwitch
          checked={config.enabled}
          disabled={busyAction !== null}
          label="总开关"
          name="enabled"
          onChange={(enabled) => void onEnabledChange(enabled)}
        />
      </div>

      <div
        className="mt-[22px] grid grid-cols-3 gap-[3px] border border-ink/10 bg-ink/[0.045] p-[3px]"
        role="tablist"
        aria-label="背景分区"
      >
        {backgroundTabs.map((tab) => {
          const state = tab.value === "wallpaper" ? config.wallpaper : config.surfaces[tab.value]
          const active = activeTab === tab.value
          return (
            <button
              key={tab.value}
              className={cn(
                "flex items-center justify-center gap-2 border-0 bg-transparent px-2.5 py-[9px] text-[10px] font-semibold text-ink/48 transition duration-150 hover:bg-paper hover:text-ink hover:shadow-[0_3px_12px_rgb(24_37_31/0.08)]",
                active && "bg-paper text-ink shadow-[0_3px_12px_rgb(24_37_31/0.08)]",
              )}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onActiveTabChange(tab.value)}
            >
              <span>{tab.label}</span>
              <i
                className={cn(
                  "size-[5px] rounded-full bg-ink/16",
                  state.enabled &&
                    state.image &&
                    "bg-citrus shadow-[0_0_0_3px_rgb(240_168_59/0.12)]",
                )}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>
      {children}
    </aside>
  )
}
