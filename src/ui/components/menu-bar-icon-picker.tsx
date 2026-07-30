import { useEffect, useState } from "react"

import { MENU_BAR_ICON_IDS, MENU_BAR_ICONS } from "../../shared/menu-bar-icons.ts"
import type { MenuBarIconId } from "../../shared/menu-bar-icons.ts"
import { cn } from "../lib/cn.ts"

function MenuBarIconPreview({ iconId }: { iconId: MenuBarIconId }) {
  const definition = MENU_BAR_ICONS[iconId]
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    setFrame(0)
    if (!definition.animated || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }
    const timer = window.setInterval(
      () => setFrame((current) => (current + 1) % definition.frames.length),
      definition.frameDurationMs,
    )
    return () => window.clearInterval(timer)
  }, [definition])

  return (
    <img
      className="size-[22px] [image-rendering:pixelated]"
      src={definition.frames[frame]}
      alt=""
      draggable="false"
    />
  )
}

interface MenuBarIconPickerProps {
  disabled: boolean
  onChange: (iconId: MenuBarIconId) => Promise<void>
  value: MenuBarIconId
}

/** Selects one built-in macOS menu bar icon with live pixel-animation previews. */
export function MenuBarIconPicker({ disabled, onChange, value }: MenuBarIconPickerProps) {
  return (
    <section className="border-b border-ink/10 pb-5" aria-labelledby="menuBarIconTitle">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id="menuBarIconTitle" className="font-display text-[25px] leading-none">
            菜单栏图标
          </h2>
          <p className="mt-1.5 text-[8px] text-ink/42">显示在 macOS 顶部状态栏，选择后立即应用</p>
        </div>
        <span className="rounded-full border border-leaf/18 bg-leaf/6 px-2 py-1 text-[7px] font-semibold tracking-[0.08em] text-leaf">
          内置像素款
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="菜单栏图标">
        {MENU_BAR_ICON_IDS.map((iconId) => {
          const definition = MENU_BAR_ICONS[iconId]
          const selected = value === iconId
          return (
            <button
              key={iconId}
              className={cn(
                "group relative min-w-0 border border-ink/10 bg-canvas/45 px-1.5 py-2.5 text-center transition duration-150 hover:-translate-y-px hover:border-leaf/45 hover:bg-paper hover:shadow-[0_8px_18px_rgb(24_37_31/0.08)] disabled:pointer-events-none disabled:opacity-55",
                selected &&
                  "border-leaf bg-paper shadow-[inset_0_-2px_0_rgb(45_106_79),0_7px_16px_rgb(24_37_31/0.07)]",
              )}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => void onChange(iconId)}
            >
              <span className="mx-auto mb-1.5 grid size-8 place-items-center rounded-[9px] border border-ink/9 bg-ink/[0.045] text-ink transition group-hover:bg-citrus/12">
                <MenuBarIconPreview iconId={iconId} />
              </span>
              <strong className="block truncate text-[8px]">{definition.label}</strong>
              <small className="mt-0.5 block truncate text-[6px] text-ink/38">
                {definition.description}
              </small>
              {definition.animated && (
                <i className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-citrus shadow-[0_0_0_3px_rgb(240_168_59/0.12)]" />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
