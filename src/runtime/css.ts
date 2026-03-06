import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import { normalizeConfig } from "./config.ts"
import type { BackgroundConfigLike } from "./types.ts"

const IMAGE_TYPES = new Map([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
])
const MAX_IMAGE_BYTES = 25 * 1024 * 1024

/** Embeds a validated local image without changing its original bytes. */
export async function imageFileToDataUrl(imagePath: string) {
  const extension = path.extname(imagePath).toLowerCase()
  const mediaType = IMAGE_TYPES.get(extension)
  if (!mediaType) throw new Error(`Unsupported image type: ${extension || "no extension"}`)
  const metadata = await stat(imagePath)
  if (!metadata.isFile()) throw new Error(`Background image is not a file: ${imagePath}`)
  if (metadata.size > MAX_IMAGE_BYTES) {
    throw new Error(`Background image exceeds the 25 MB limit: ${imagePath}`)
  }
  const contents = await readFile(imagePath)
  return `data:${mediaType};base64,${contents.toString("base64")}`
}

/** Builds the isolated character layer injected into Codex's main workspace. */
export async function buildBackgroundCss(input: BackgroundConfigLike) {
  const config = normalizeConfig(input)
  if (!config.enabled) throw new Error("Codex background is disabled.")
  if (!config.image) throw new Error("No background image is configured.")
  const dataUrl = await imageFileToDataUrl(config.image)
  return `
:root[data-codex-window-type="electron"] .main-surface,
:root[data-codex-window-type="electron"] .browser-main-surface {
  position: relative !important;
  isolation: isolate;
}

:root[data-codex-window-type="electron"] .main-surface::before,
:root[data-codex-window-type="electron"] .browser-main-surface::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url("${dataUrl}") !important;
  background-position: ${config.illustrationX}% ${config.illustrationY}% !important;
  background-repeat: no-repeat !important;
  background-size: ${config.illustrationSize}px auto !important;
  filter: blur(${config.illustrationBlur}px);
  opacity: ${config.illustrationOpacity};
}
`.trim()
}
