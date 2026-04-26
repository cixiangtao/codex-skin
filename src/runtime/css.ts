import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import { anchoredBackgroundPosition } from "../shared/background-position.ts"
import { configuredBackgroundSurfaces, normalizeConfig } from "./config.ts"
import type { BackgroundConfigLike, BackgroundSurface, SurfaceBackgroundConfig } from "./types.ts"

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

const SURFACE_SELECTORS = {
  main: [
    ':root[data-codex-window-type="electron"] .main-surface',
    ':root[data-codex-window-type="electron"] .browser-main-surface',
  ],
  sidebar: [':root[data-codex-window-type="electron"] .app-shell-left-panel'],
} as const satisfies Record<BackgroundSurface, readonly string[]>

function surfaceCss(surface: BackgroundSurface, config: SurfaceBackgroundConfig, dataUrl: string) {
  const selectors = SURFACE_SELECTORS[surface]
  const roots = selectors.join(",\n")
  const pseudoElements = selectors.map((selector) => `${selector}::before`).join(",\n")
  const clipping = surface === "sidebar" ? "\n  clip-path: inset(0);" : ""

  return `
${roots} {
  position: relative !important;
  isolation: isolate;
}

${pseudoElements} {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url("${dataUrl}") !important;
  background-position: ${anchoredBackgroundPosition(config.illustrationX, config.illustrationY)} !important;
  background-repeat: no-repeat !important;
  background-size: ${config.illustrationSize}px auto !important;
  filter: blur(${config.illustrationBlur}px);
  opacity: ${config.illustrationOpacity};${clipping}
}`.trim()
}

/** Builds independent character layers for every enabled Codex surface. */
export async function buildBackgroundCss(input: BackgroundConfigLike) {
  const config = normalizeConfig(input)
  if (!config.enabled) throw new Error("Codex background is disabled.")
  const surfaces = configuredBackgroundSurfaces(config)
  if (surfaces.length === 0) throw new Error("No background image is configured.")

  const rules = await Promise.all(
    surfaces.map(async (surface) => {
      const surfaceConfig = config.surfaces[surface]
      if (!surfaceConfig.image) throw new Error(`No ${surface} background image is configured.`)
      return surfaceCss(surface, surfaceConfig, await imageFileToDataUrl(surfaceConfig.image))
    }),
  )
  return rules.join("\n\n")
}
