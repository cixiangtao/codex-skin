import type { ReactNode } from "react"

import { backgroundSurfaces } from "../model.ts"
import type { BackgroundConfig, BackgroundSurface, BusyAction } from "../types.ts"

interface ControlPanelProps {
  activeSurface: BackgroundSurface
  busyAction: BusyAction
  children: ReactNode
  config: BackgroundConfig
  onActiveSurfaceChange: (surface: BackgroundSurface) => void
  onEnabledChange: (enabled: boolean) => Promise<void>
}

/** Renders the global background controls and composes the selected surface settings. */
export function ControlPanel({
  activeSurface,
  busyAction,
  children,
  config,
  onActiveSurfaceChange,
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
        {Object.values(backgroundSurfaces).map((surface) => {
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
      {children}
    </aside>
  )
}
