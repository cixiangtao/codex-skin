import type { ReactNode } from "react"

import { backgroundTabs } from "../model.ts"
import type { BackgroundConfig, BackgroundSettingsTab, BusyAction } from "../types.ts"

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
        {backgroundTabs.map((tab) => {
          const state = tab.value === "wallpaper" ? config.wallpaper : config.surfaces[tab.value]
          const active = activeTab === tab.value
          return (
            <button
              key={tab.value}
              className={active ? "is-active" : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onActiveTabChange(tab.value)}
            >
              <span>{tab.label}</span>
              <i
                className={state.enabled && state.image ? "is-configured" : undefined}
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
