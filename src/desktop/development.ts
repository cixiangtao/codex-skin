import path from "node:path"

export const DESKTOP_DEVELOPMENT_API_PORT = 4179

interface DesktopDevelopmentSettings {
  authenticatedRedirectUrl: string
  backgroundsRoot: string
  port: number
}

/**
 * Resolves the settings-server overrides used by the electron-vite development renderer.
 *
 * The renderer and API use separate local ports in development. Both stay on 127.0.0.1 so
 * the authenticated settings cookie can pass through Vite's `/api` proxy.
 */
export function desktopDevelopmentSettings(
  rendererUrl: string | undefined,
  projectRoot: string,
): DesktopDevelopmentSettings | undefined {
  if (!rendererUrl) return undefined

  const url = new URL(rendererUrl)
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("The desktop development renderer must use http://127.0.0.1.")
  }

  return {
    authenticatedRedirectUrl: url.href,
    backgroundsRoot: path.join(projectRoot, "public/backgrounds"),
    port: DESKTOP_DEVELOPMENT_API_PORT,
  }
}

/** Returns the local origins that may host the desktop settings renderer. */
export function desktopNavigationOrigins(settingsUrl: string, rendererUrl?: string) {
  return new Set(
    [settingsUrl, rendererUrl]
      .filter((url): url is string => Boolean(url))
      .map((url) => new URL(url).origin),
  )
}
