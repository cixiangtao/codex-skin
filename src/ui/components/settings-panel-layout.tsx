import type { FormEvent, ReactNode } from "react"

import type { BusyAction } from "../types.ts"
import { ToggleSwitch } from "./toggle-switch.tsx"

interface SettingsPanelLayoutProps {
  actionNote: string
  ariaLabel: string
  busyAction: BusyAction
  canStartBackground: boolean
  children: ReactNode
  description: string
  enabled: boolean
  enabledName: string
  label: string
  onEnabledChange: (enabled: boolean) => Promise<void>
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onStart: () => Promise<void>
  saveLabel: string
}

/**
 * Keeps a settings panel's identity and primary actions visible while its controls scroll.
 *
 * On narrow screens the regions return to normal document flow to avoid nested scrolling.
 */
export function SettingsPanelLayout({
  actionNote,
  ariaLabel,
  busyAction,
  canStartBackground,
  children,
  description,
  enabled,
  enabledName,
  label,
  onEnabledChange,
  onSave,
  onStart,
  saveLabel,
}: SettingsPanelLayoutProps) {
  const disabled = busyAction !== null

  return (
    <section
      className="lg:grid lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]"
      aria-label={ariaLabel}
    >
      <div className="mt-[18px] flex items-center justify-between border-b border-ink/10 pb-3.5">
        <div>
          <strong className="block text-[11px]">{label}</strong>
          <small className="mt-[3px] block text-[8px] text-ink/42">{description}</small>
        </div>
        <ToggleSwitch
          checked={enabled}
          compact
          disabled={disabled}
          label="显示"
          name={enabledName}
          onChange={(nextEnabled) => void onEnabledChange(nextEnabled)}
        />
      </div>

      <form
        className="lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto]"
        onSubmit={(event) => void onSave(event)}
      >
        <div
          className="lg:min-h-0 lg:[scrollbar-gutter:stable] lg:overflow-y-auto lg:overscroll-y-contain lg:pb-5"
          data-settings-scroll-region
        >
          {children}
        </div>

        <footer className="mt-6 grid gap-3 lg:mt-0 lg:border-t lg:border-ink/10 lg:bg-paper/72 lg:pt-5">
          <button
            className="flex w-full cursor-pointer items-center justify-between border-0 bg-ink px-[15px] py-[13px] text-[11px] text-paper transition duration-160 hover:-translate-y-px hover:bg-leaf disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-42 [&>i]:not-italic"
            type="submit"
            disabled={disabled}
          >
            <span>{busyAction === "save" ? "正在应用…" : saveLabel}</span>
            <i aria-hidden="true">↗</i>
          </button>
          {canStartBackground ? (
            <button
              className="flex w-full cursor-pointer items-center justify-center border border-ink/16 bg-transparent px-[15px] py-[13px] text-[11px] text-ink transition duration-160 hover:border-leaf/40 hover:bg-leaf/6 disabled:cursor-not-allowed disabled:opacity-42"
              type="button"
              disabled={disabled}
              onClick={() => void onStart()}
            >
              <span>{busyAction === "start" ? "正在启动…" : "启动背景模式"}</span>
            </button>
          ) : null}
          {actionNote ? (
            <p className="m-0 text-[10px] leading-[1.6] text-pretty text-ink/52">{actionNote}</p>
          ) : null}
        </footer>
      </form>
    </section>
  )
}
