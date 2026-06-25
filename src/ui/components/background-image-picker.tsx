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
    <section className="image-setting" aria-label={title}>
      <div className="image-setting-heading">
        <h3>{title}</h3>
        <span>选择后立即应用</span>
      </div>

      <button
        className="image-upload-card"
        type="button"
        disabled={disabled}
        onClick={onChooseImage}
      >
        <span className="image-upload-card-preview">
          <span
            className={`image-thumbnail${imageSource ? "" : " is-empty"} flex`}
            aria-hidden="true"
          >
            {imageSource ? (
              <img src={imageSource} alt="" width="56" height="56" />
            ) : (
              <span>＋</span>
            )}
          </span>
          <span className="image-setting-copy min-w-0">
            <strong title={imageLabel}>{imageLabel}</strong>
            <small className={advice.warning ? "is-warning" : undefined}>{advice.text}</small>
          </span>
        </span>
        <span className="image-upload-card-action">
          <b>{uploadLabel}</b>
          <small>{uploadHint}</small>
        </span>
      </button>

      <div className="bundled-background-picker">
        <div className="bundled-background-heading">
          <span>{bundledLabel}</span>
          <small>{bundledBackgrounds.items.length} 张</small>
        </div>
        {bundledBackgrounds.items.length > 0 ? (
          <div className="bundled-background-list" aria-label={`${bundledLabel}预览列表`}>
            {bundledBackgrounds.items.map((item) => {
              const selected = item.file === bundledBackgrounds.selected

              return (
                <button
                  key={item.file}
                  className={`bundled-background-option is-${variant}${selected ? " is-selected" : ""}`}
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  title={item.label}
                  onClick={() => {
                    if (!selected) void onSelectBundledBackground(item.file)
                  }}
                >
                  <span className="bundled-background-thumbnail" aria-hidden="true">
                    <img src={item.url} alt="" loading="lazy" decoding="async" />
                    {selected && <i>✓</i>}
                  </span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="bundled-background-empty">暂无内置素材</p>
        )}
      </div>
    </section>
  )
}
