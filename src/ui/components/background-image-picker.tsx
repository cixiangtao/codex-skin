import { cn } from "../lib/cn.ts"
import type { BundledBackgroundGroup, BusyAction } from "../types.ts"

interface BackgroundImagePickerProps {
  advice: { warning?: boolean; text: string }
  busyAction: BusyAction
  bundledBackgrounds: BundledBackgroundGroup
  bundledLabel: string
  imageLabel: string
  imageSource?: string
  onChooseImage: () => void
  onSelectBundledBackground: (file: string) => Promise<void>
  title: string
  uploadHint: string
  uploadLabel: string
  variant: "illustration" | "wallpaper"
}

/** Renders the shared bundled-image picker and local upload action for a background layer. */
export function BackgroundImagePicker({
  advice,
  busyAction,
  bundledBackgrounds,
  bundledLabel,
  imageLabel,
  imageSource,
  onChooseImage,
  onSelectBundledBackground,
  title,
  uploadHint,
  uploadLabel,
  variant,
}: BackgroundImagePickerProps) {
  const disabled = busyAction !== null

  return (
    <section className="border-b border-ink/10 pt-[15px] pb-[18px]" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="m-0 text-[9px] font-bold tracking-[0.14em] text-ink/46">{title}</h3>
        <span className="text-[8px] text-leaf">选择后立即应用</span>
      </div>

      <button
        className="group mt-[13px] block w-full overflow-hidden border border-ink/14 bg-transparent p-0 text-left text-ink transition duration-160 hover:border-leaf/38 hover:bg-leaf/[0.025] hover:text-leaf disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={disabled}
        onClick={onChooseImage}
      >
        <span className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 p-2.5">
          <span
            className={cn(
              "flex size-14 place-items-center overflow-hidden border border-ink/12 bg-[linear-gradient(45deg,rgb(24_37_31/0.045)_25%,transparent_25%)_0_0/12px_12px,linear-gradient(-45deg,rgb(24_37_31/0.045)_25%,transparent_25%)_0_0/12px_12px,var(--color-paper)]",
              !imageSource && "border-dashed bg-leaf/[0.055] text-xl text-leaf/58",
            )}
            aria-hidden="true"
          >
            {imageSource ? (
              <img
                className="size-full object-contain"
                src={imageSource}
                alt=""
                width="56"
                height="56"
              />
            ) : (
              <span>＋</span>
            )}
          </span>
          <span className="min-w-0">
            <strong
              className="block overflow-hidden text-[11px] font-semibold text-ellipsis whitespace-nowrap"
              title={imageLabel}
            >
              {imageLabel}
            </strong>
            <small
              className={cn(
                "mt-1.5 block text-[8px] leading-[1.55] text-ink/45 text-pretty",
                advice.warning && "text-[#a86218]",
              )}
            >
              {advice.text}
            </small>
          </span>
        </span>
        <span className="flex items-center justify-between gap-3 border-t border-ink/9 bg-leaf/[0.035] px-2.5 py-2 text-leaf group-hover:bg-leaf/[0.075]">
          <b className="text-[9px] font-[650]">{uploadLabel}</b>
          <small className="text-[8px] text-ink/40">{uploadHint}</small>
        </span>
      </button>

      <div className="mt-[15px]">
        <div className="mb-2 flex items-center justify-between text-[9px] font-[650] text-ink/58">
          <span>{bundledLabel}</span>
          <small className="text-[8px] font-medium text-ink/34">
            {bundledBackgrounds.items.length} 张
          </small>
        </div>
        {bundledBackgrounds.items.length > 0 ? (
          <div className="grid grid-cols-3 gap-[7px]" aria-label={`${bundledLabel}预览列表`}>
            {bundledBackgrounds.items.map((item) => {
              const selected = item.file === bundledBackgrounds.selected

              return (
                <button
                  key={item.file}
                  className={cn(
                    "grid min-w-0 cursor-pointer gap-[5px] overflow-hidden border border-ink/11 bg-transparent p-1 text-left text-[8px] text-ink/55 transition duration-150 hover:-translate-y-px hover:border-leaf/36 hover:bg-leaf/[0.045] hover:text-leaf disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 [&>span:last-child]:overflow-hidden [&>span:last-child]:px-0.5 [&>span:last-child]:pb-px [&>span:last-child]:text-ellipsis [&>span:last-child]:whitespace-nowrap",
                    selected &&
                      "border-leaf bg-leaf/7 text-ink shadow-[inset_0_0_0_1px_rgb(45_106_79/0.14)]",
                  )}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  title={item.label}
                  onClick={() => {
                    if (!selected) void onSelectBundledBackground(item.file)
                  }}
                >
                  <span
                    className={cn(
                      "relative flex min-h-0 w-full min-w-0 items-center justify-center overflow-hidden bg-[linear-gradient(45deg,rgb(24_37_31/0.04)_25%,transparent_25%)_0_0/10px_10px,linear-gradient(-45deg,rgb(24_37_31/0.04)_25%,transparent_25%)_0_0/10px_10px,rgb(255_253_247/0.7)]",
                      variant === "wallpaper" ? "aspect-16/10" : "aspect-square",
                    )}
                    aria-hidden="true"
                  >
                    <img
                      className="block h-auto max-h-full w-auto max-w-full flex-none object-contain"
                      src={item.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    {selected && (
                      <i className="absolute top-1 right-1 grid size-[17px] place-items-center rounded-full border-2 border-paper bg-leaf text-[8px] text-paper not-italic shadow-[0_2px_8px_rgb(24_37_31/0.2)]">
                        ✓
                      </i>
                    )}
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="m-0 border border-dashed border-ink/13 bg-ink/[0.025] p-3.5 text-center text-[9px] text-ink/38">
            暂无内置素材
          </p>
        )}
      </div>
    </section>
  )
}
