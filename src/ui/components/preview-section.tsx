import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, RefObject } from "react"

import { axisAnchor } from "../../shared/background-position.ts"
import { cn } from "../lib/cn.ts"
import { backgroundSurfaceIsEnabled, backgroundTabs, previewThemes } from "../model.ts"
import type {
  BackgroundConfig,
  BackgroundSettingsTab,
  BackgroundSurface,
  PreviewTheme,
  SurfaceBackgroundConfig,
} from "../types.ts"

interface IllustrationStyle extends CSSProperties {
  "--illustration-blur": string
  "--illustration-opacity": number
  "--illustration-preview-size": string
}

interface WallpaperPreviewStyle extends CSSProperties {
  "--wallpaper-image"?: string
  "--wallpaper-position"?: string
  "--wallpaper-size"?: string
  "--wallpaper-surface-background"?: string
}

interface PreviewSectionProps {
  activeTab: BackgroundSettingsTab
  config: BackgroundConfig
  effectiveTheme: Exclude<PreviewTheme, "system">
  fileDragging: boolean
  illustrationDragging?: BackgroundSurface
  imageSources: Record<BackgroundSettingsTab, string | undefined>
  onActiveTabChange: (tab: BackgroundSettingsTab) => void
  onChooseImage: () => void
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLDivElement>) => void
  onFinishIllustrationDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
  onMoveIllustration: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPreviewThemeChange: (theme: PreviewTheme) => void
  onStartIllustrationDrag: (
    surface: BackgroundSurface,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void
  placementStageRefs: Record<BackgroundSurface, RefObject<HTMLDivElement | null>>
  previewTheme: PreviewTheme
}

interface SurfaceIllustrationProps {
  active: boolean
  config: SurfaceBackgroundConfig
  dragging: boolean
  enabled: boolean
  imageSource?: string
  onFinish: (event: ReactPointerEvent<HTMLDivElement>) => void
  onMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onStart: (surface: BackgroundSurface, event: ReactPointerEvent<HTMLDivElement>) => void
  surface: BackgroundSurface
}

function axisPlacement(position: number, axis: "horizontal" | "vertical") {
  const anchor = axisAnchor(position)
  const start = axis === "horizontal" ? "left" : "top"
  const end = axis === "horizontal" ? "right" : "bottom"
  if (anchor.edge === "start") {
    return { inset: { [start]: `${anchor.offset}%` }, translate: -anchor.offset }
  }
  if (anchor.edge === "end") {
    return { inset: { [end]: `${anchor.offset}%` }, translate: anchor.offset }
  }
  return { inset: { [start]: "50%" }, translate: -50 }
}

function illustrationStyle(
  surface: BackgroundSurface,
  config: SurfaceBackgroundConfig,
): IllustrationStyle {
  const logicalSurfaceWidth = surface === "main" ? 900 : 300
  const previewSize = Math.min(
    260,
    Math.max(7, (config.illustrationSize / logicalSurfaceWidth) * 100),
  )
  const horizontal = axisPlacement(config.illustrationX, "horizontal")
  const vertical = axisPlacement(config.illustrationY, "vertical")
  return {
    ...horizontal.inset,
    ...vertical.inset,
    "--illustration-blur": `${config.illustrationBlur}px`,
    "--illustration-opacity": config.illustrationOpacity,
    "--illustration-preview-size": `${previewSize}%`,
    translate: `${horizontal.translate}% ${vertical.translate}%`,
  }
}

function SurfaceIllustration({
  active,
  config,
  dragging,
  enabled,
  imageSource,
  onFinish,
  onMove,
  onStart,
  surface,
}: SurfaceIllustrationProps) {
  if (!enabled || !imageSource) return null
  const surfaceLabel = surface === "main" ? "主面板" : "侧边栏"
  return (
    <div
      className={cn(
        "group absolute z-[1] w-[var(--illustration-preview-size)] cursor-grab touch-none opacity-[var(--illustration-opacity)] [filter:blur(var(--illustration-blur))_drop-shadow(0_14px_20px_rgb(0_0_0/0.22))] [transition:width_140ms_ease,top_140ms_ease,left_140ms_ease,filter_140ms_ease,opacity_140ms_ease] hover:outline hover:outline-dashed hover:outline-citrus/90 hover:outline-offset-[5px]",
        active &&
          "[filter:blur(var(--illustration-blur))_drop-shadow(0_14px_20px_rgb(0_0_0/0.28))]",
        dragging &&
          "cursor-grabbing outline outline-citrus outline-solid outline-offset-[5px] transition-none",
      )}
      style={illustrationStyle(surface, config)}
      role="img"
      aria-label={`${surfaceLabel}人物插图预览`}
      onPointerDown={(event) => onStart(surface, event)}
      onPointerMove={onMove}
      onPointerUp={onFinish}
      onPointerCancel={onFinish}
    >
      <img
        className="pointer-events-none block h-auto w-full select-none"
        src={imageSource}
        alt=""
        draggable="false"
      />
      <span
        className={cn(
          "absolute top-[-13px] left-1/2 -translate-x-1/2 -translate-y-full rounded-[20px] bg-[#f5bd5f] px-[7px] py-[3px] text-[7px] text-ink opacity-0 transition-opacity duration-150 group-hover:opacity-100",
          dragging && "opacity-100",
        )}
      >
        拖动
      </span>
    </div>
  )
}

/** Renders both configured Codex surfaces and supports direct manipulation per surface. */
export function PreviewSection({
  activeTab,
  config,
  effectiveTheme,
  fileDragging,
  illustrationDragging,
  imageSources,
  onActiveTabChange,
  onChooseImage,
  onDragEnter,
  onDragLeave,
  onDrop,
  onFinishIllustrationDrag,
  onMoveIllustration,
  onPreviewThemeChange,
  onStartIllustrationDrag,
  placementStageRefs,
  previewTheme,
}: PreviewSectionProps) {
  const activeLabel = backgroundTabs.find((tab) => tab.value === activeTab)?.label || "背景"
  const wallpaperVisible = Boolean(
    config.enabled && config.wallpaper.enabled && imageSources.wallpaper,
  )
  const hasVisibleImage =
    wallpaperVisible ||
    (["main", "sidebar"] as const).some(
      (surface) => backgroundSurfaceIsEnabled(config, surface) && imageSources[surface],
    )
  const wallpaperStyle: WallpaperPreviewStyle = wallpaperVisible
    ? {
        "--wallpaper-image": `url("${imageSources.wallpaper}")`,
        "--wallpaper-position": `${config.wallpaper.positionX}% ${config.wallpaper.positionY}%`,
        "--wallpaper-size": config.wallpaper.fit,
        "--wallpaper-surface-background": `color-mix(in srgb, var(--mock-main-background) ${Math.round((1 - config.wallpaper.backgroundTransparency) * 10_000) / 100}%, transparent)`,
      }
    : {}
  return (
    <section
      aria-labelledby="pageTitle"
      className="min-w-0 lg:min-h-0 lg:[scrollbar-gutter:stable] lg:overflow-y-auto lg:overscroll-y-contain"
    >
      <div className="mb-3.5 flex items-baseline justify-between gap-6">
        <h1
          id="pageTitle"
          className="m-0 font-display text-[clamp(28px,3vw,38px)] leading-none font-normal tracking-[-0.035em] text-balance"
        >
          实时预览
        </h1>
        <p className="m-0 text-[10px] text-ink/48">
          {hasVisibleImage ? `当前编辑：${activeLabel}` : "选择图片后实时预览"}
        </p>
      </div>

      <div
        className="relative overflow-hidden border border-ink/16 bg-paper p-[clamp(10px,1vw,15px)] shadow-[0_30px_70px_rgb(59_53_36/0.13)] before:pointer-events-none before:absolute before:inset-[5px] before:z-[5] before:border before:border-leaf/20 before:content-['']"
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="relative aspect-16/10 min-h-[380px] overflow-hidden bg-[#e7e7df] max-sm:aspect-4/5 max-sm:min-h-80">
          <div
            className="absolute top-[calc(7%+10px)] right-[calc(7%+10px)] z-[7] flex gap-0.5 rounded-full border border-ink/13 bg-paper/90 p-[3px] shadow-[0_7px_20px_rgb(24_37_31/0.13)] backdrop-blur-xl"
            role="group"
            aria-label="Codex 预览主题"
          >
            {previewThemes.map((theme) => (
              <button
                key={theme.value}
                className={cn(
                  "rounded-full border-0 bg-transparent px-2 py-1 text-[7px] font-bold tracking-[0.05em] text-ink/48 transition duration-150 hover:bg-leaf hover:text-paper",
                  previewTheme === theme.value && "bg-leaf text-paper",
                )}
                type="button"
                aria-pressed={previewTheme === theme.value}
                onClick={() => onPreviewThemeChange(theme.value)}
              >
                {theme.label}
              </button>
            ))}
          </div>
          <div
            className={cn(
              "absolute inset-[7%] grid grid-cols-[25%_1fr] overflow-hidden rounded-[clamp(10px,1.2vw,17px)] border border-ink/12 bg-[var(--mock-main-background)] text-[var(--mock-text)] shadow-[0_28px_55px_rgb(24_37_31/0.2)] [--mock-active-line:rgb(240_168_59/0.4)] [--mock-composer-background:rgb(46_55_50/0.92)] [--mock-composer-border:rgb(255_255_255/0.1)] [--mock-divider:rgb(255_255_255/0.07)] [--mock-grid-line:rgb(255_255_255/0.18)] [--mock-line:rgb(255_255_255/0.1)] [--mock-main-background:#252c28] [--mock-muted:rgb(232_236_233/0.48)] [--mock-sidebar-background:#171c19] [--mock-text:#e8ece9] max-sm:inset-[5%] max-sm:grid-cols-[29%_1fr]",
              effectiveTheme === "light" &&
                "[--mock-active-line:rgb(217_143_31/0.34)] [--mock-composer-background:rgb(255_255_255/0.92)] [--mock-composer-border:rgb(24_37_31/0.12)] [--mock-divider:rgb(24_37_31/0.09)] [--mock-grid-line:rgb(24_37_31/0.13)] [--mock-line:rgb(24_37_31/0.1)] [--mock-main-background:#f6f6f2] [--mock-muted:rgb(24_37_31/0.5)] [--mock-sidebar-background:#ecece7] [--mock-text:#26312c]",
              wallpaperVisible &&
                "[background-image:var(--wallpaper-image)] [background-position:var(--wallpaper-position)] [background-repeat:no-repeat] [background-size:var(--wallpaper-size)]",
            )}
            data-theme={effectiveTheme}
            style={wallpaperStyle}
          >
            <aside
              ref={placementStageRefs.sidebar}
              className={cn(
                "relative overflow-hidden border-r border-[var(--mock-divider)] bg-[var(--mock-sidebar-background)] px-[clamp(10px,1.7vw,24px)] py-[15px] transition-shadow duration-160",
                activeTab === "sidebar" && "shadow-[inset_0_0_0_1px_rgb(240_168_59/0.7)]",
                wallpaperVisible &&
                  "bg-[color-mix(in_srgb,var(--mock-sidebar-background)_70%,transparent)] backdrop-blur-sm",
              )}
              onClick={() => onActiveTabChange("sidebar")}
            >
              <SurfaceIllustration
                active={activeTab === "sidebar"}
                config={config.surfaces.sidebar}
                dragging={illustrationDragging === "sidebar"}
                enabled={backgroundSurfaceIsEnabled(config, "sidebar")}
                imageSource={imageSources.sidebar}
                onFinish={onFinishIllustrationDrag}
                onMove={onMoveIllustration}
                onStart={onStartIllustrationDrag}
                surface="sidebar"
              />
              <div className="pointer-events-none relative z-[2]" aria-hidden="true">
                <div className="mb-[clamp(18px,3vw,38px)] flex gap-[5px]">
                  <i className="size-1.5 rounded-full bg-[var(--mock-muted)]" />
                  <i className="size-1.5 rounded-full bg-[var(--mock-muted)]" />
                  <i className="size-1.5 rounded-full bg-[var(--mock-muted)]" />
                </div>
                <div className="mb-5 flex items-center gap-[7px] text-[clamp(6px,0.7vw,10px)]">
                  <b>＋</b>
                  <span>新任务</span>
                </div>
                <p className="mt-[clamp(17px,2.4vw,30px)] mb-2 text-[6px] tracking-[0.13em] text-[var(--mock-muted)]">
                  今天
                </p>
                <span className="my-2.5 block h-[5px] w-4/5 rounded-[20px] bg-[var(--mock-line)]" />
                <span className="my-2.5 block h-[5px] w-3/5 rounded-[20px] bg-[var(--mock-line)]" />
                <span className="my-2.5 block h-[5px] w-11/12 rounded-[20px] bg-[var(--mock-active-line)]" />
                <p className="mt-[clamp(17px,2.4vw,30px)] mb-2 text-[6px] tracking-[0.13em] text-[var(--mock-muted)]">
                  项目
                </p>
                <span className="my-2.5 block h-[5px] w-2/3 rounded-[20px] bg-[var(--mock-line)]" />
                <span className="my-2.5 block h-[5px] w-3/4 rounded-[20px] bg-[var(--mock-line)]" />
              </div>
            </aside>

            <div
              ref={placementStageRefs.main}
              className={cn(
                "relative flex flex-col justify-center overflow-hidden bg-[var(--mock-main-background)] p-[clamp(20px,3.2vw,52px)] transition-shadow duration-160",
                activeTab === "main" && "shadow-[inset_0_0_0_1px_rgb(240_168_59/0.7)]",
                wallpaperVisible && "bg-[var(--wallpaper-surface-background)]",
              )}
              onClick={() => onActiveTabChange("main")}
            >
              <div
                className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--mock-grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--mock-grid-line)_1px,transparent_1px)] [background-size:25%_25%] opacity-12"
                aria-hidden="true"
              />
              <SurfaceIllustration
                active={activeTab === "main"}
                config={config.surfaces.main}
                dragging={illustrationDragging === "main"}
                enabled={backgroundSurfaceIsEnabled(config, "main")}
                imageSource={imageSources.main}
                onFinish={onFinishIllustrationDrag}
                onMove={onMoveIllustration}
                onStart={onStartIllustrationDrag}
                surface="main"
              />
              {!hasVisibleImage && (
                <div className="absolute inset-[18%_12%_24%] z-[2] grid place-content-center justify-items-center text-center max-sm:inset-[18%_8%_25%]">
                  <span
                    className="mb-3 grid size-[38px] place-items-center rounded-full border border-dashed border-leaf/35 bg-leaf/8 text-xl text-leaf"
                    aria-hidden="true"
                  >
                    ＋
                  </span>
                  <strong className="font-display text-[clamp(14px,1.3vw,19px)] font-normal">
                    {activeTab === "wallpaper" ? "尚未选择背景图片" : "尚未选择人物图片"}
                  </strong>
                  <p className="mt-1.5 mb-[13px] text-[clamp(6px,0.7vw,9px)] text-[var(--mock-muted)]">
                    {activeTab === "wallpaper"
                      ? "选择一张图片，或直接拖入以设置全局背景"
                      : "选择一张图片，或直接拖入当前分区"}
                  </p>
                  <button
                    className="border-0 bg-leaf px-[13px] py-2 text-[9px] text-paper transition duration-160 hover:-translate-y-px hover:bg-ink"
                    type="button"
                    onClick={onChooseImage}
                  >
                    {activeTab === "wallpaper" ? "选择背景图片" : "选择人物图片"}
                  </button>
                </div>
              )}
              <div
                className="absolute top-[15px] right-[18px] left-[18px] flex justify-end gap-2"
                aria-hidden="true"
              >
                <span className="h-[5px] w-2/3 rounded-[20px] bg-[var(--mock-line)]" />
                <i className="size-[5px] rounded-[20px] bg-[var(--mock-line)]" />
              </div>
              <div
                className="absolute right-[clamp(20px,3.2vw,52px)] bottom-[clamp(16px,2.2vw,32px)] left-[clamp(20px,3.2vw,52px)] z-[2] flex items-center justify-between rounded-[10px] border border-[var(--mock-composer-border)] bg-[var(--mock-composer-background)] p-[clamp(8px,1.2vw,15px)] text-[clamp(6px,0.7vw,9px)] text-[var(--mock-muted)]"
                aria-hidden="true"
              >
                <span>询问 Codex 任何问题</span>
                <i className="grid size-5 place-items-center rounded-full bg-[#f2b652] text-ink not-italic">
                  ↑
                </i>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "invisible pointer-events-none absolute inset-3 z-[8] grid place-content-center border border-dashed border-leaf bg-paper/94 text-center opacity-0 transition duration-160",
            fileDragging && "visible opacity-100",
          )}
          aria-hidden="true"
        >
          <strong className="font-display text-[32px] font-normal">松开以更新{activeLabel}</strong>
        </div>
      </div>
    </section>
  )
}
