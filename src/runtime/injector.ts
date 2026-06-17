import { createHash } from "node:crypto"

import { CdpConnection, listPageTargets, validatedDebuggerUrl } from "./cdp.ts"
import type { CdpOptions, CdpDiscoveryOptions } from "./cdp.ts"
import type { CdpTarget, InjectionResult } from "./types.ts"
import { errorMessage } from "./types.ts"

export const BACKGROUND_STYLE_ID = "codex-skin-style"

interface RuntimeEvaluateResponse {
  exceptionDetails?: {
    exception?: { description?: string }
    text?: string
  }
  result?: { value?: unknown }
}

export interface BackgroundVerification {
  backgroundImage: string
  enabled: boolean
  hashMatches: boolean
  href: string
  pass: boolean
  pointerEvents: string
  stylePresent: boolean
  surfacePresent: boolean
  surfaces?: {
    main: SurfaceVerification
    sidebar: SurfaceVerification
  }
  wallpaper?: WallpaperVerification
}

export interface SurfaceVerification {
  backgroundImage: string
  expected: boolean
  pass: boolean
  pointerEvents: string
  present: boolean
}

export interface WallpaperVerification {
  backgroundImage: string
  expected: boolean
  expectedSurfaceBackground: string
  mainSurfaceBackground: string
  mainSurfaceMatchesVariable: boolean
  mainSurfacePresent: boolean
  pass: boolean
  sidebarBridgeTransparent: boolean
  surfaceVariableConfigured: boolean
  terminalSurfacesMatch: boolean
  topFadeTransparent: boolean
}

export interface TargetVerification extends BackgroundVerification {
  error?: string
  id?: string
  title?: string
  url?: string
}

interface TargetSession {
  connection: CdpConnection
  cssHash: string
  target: CdpTarget
}

interface TargetSessionManagerOptions extends InjectionOptions {
  onError?: (error: Error) => void
}

function serializeForJavaScript(value: string) {
  return JSON.stringify(value).replaceAll("</", "<\\/")
}

export function backgroundCssHash(css: string) {
  return createHash("sha256").update(css).digest("hex").slice(0, 16)
}

function buildStyleHashProbeExpression(hash: string) {
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID)
  const serializedHash = serializeForJavaScript(hash)
  return `document.getElementById(${serializedId})?.dataset.codexSkinHash === ${serializedHash}`
}

export function buildInjectionExpression(css: string) {
  const serializedCss = serializeForJavaScript(css)
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID)
  const serializedHash = serializeForJavaScript(backgroundCssHash(css))
  return `(() => {
    const styleId = ${serializedId};
    const css = ${serializedCss};
    const install = () => {
      let style = document.getElementById(styleId);
      if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        (document.head || document.documentElement).appendChild(style);
      }
      if (style.textContent !== css) style.textContent = css;
      style.dataset.codexSkinHash = ${serializedHash};
    };
    window.__codexSkinCleanup?.();
    install();
    let installTimer;
    const scheduleInstall = () => {
      clearTimeout(installTimer);
      installTimer = setTimeout(install, 120);
    };
    const observer = new MutationObserver(scheduleInstall);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__codexSkinCleanup = () => {
      observer.disconnect();
      clearTimeout(installTimer);
    };
    document.documentElement.dataset.codexSkin = "enabled";
    return { installed: true, styleId, href: location.href };
  })()`
}

export function buildVerificationExpression(css: string) {
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID)
  const serializedHash = serializeForJavaScript(backgroundCssHash(css))
  const expectedMain = css.includes(".app-shell-main-content-viewport::before")
  const expectedSidebar = css.includes(".app-shell-left-panel::before")
  const expectedWallpaper = css.includes(':root[data-codex-window-type="electron"] body')
  return `(() => {
    const style = document.getElementById(${serializedId});
    const inspectSurface = (selector, expected) => {
      const surface = document.querySelector(selector);
      const pseudo = surface ? getComputedStyle(surface, '::before') : null;
      const result = {
        expected,
        present: Boolean(surface),
        backgroundImage: pseudo?.backgroundImage || '',
        pointerEvents: pseudo?.pointerEvents || '',
      };
      return {
        ...result,
        pass: !expected || (result.present && result.backgroundImage !== '' &&
          result.backgroundImage !== 'none' && result.pointerEvents === 'none'),
      };
    };
    const surfaces = {
      main: inspectSurface('.app-shell-main-content-viewport', ${expectedMain}),
      sidebar: inspectSurface('.app-shell-left-panel', ${expectedSidebar}),
    };
    const bodyBackgroundImage = getComputedStyle(document.body).backgroundImage;
    const mainSurface = document.querySelector('.main-surface');
    const mainSurfaceBackground = mainSurface ? getComputedStyle(mainSurface).backgroundColor : '';
    const surfaceVariable = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-token-main-surface-primary').trim();
    const surfaceProbe = document.createElement('span');
    surfaceProbe.style.cssText = 'position:fixed;width:0;height:0;visibility:hidden;pointer-events:none;';
    surfaceProbe.style.backgroundColor = 'var(--color-token-main-surface-primary)';
    document.body.append(surfaceProbe);
    const expectedSurfaceBackground = getComputedStyle(surfaceProbe).backgroundColor;
    surfaceProbe.remove();
    const terminalSurfaces = [
      ...document.querySelectorAll('[data-codex-terminal="true"], [data-codex-terminal="true"] .xterm-viewport'),
    ];
    const transparentPaint = (style) =>
      (style.backgroundColor === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)') &&
      style.backgroundImage === 'none';
    const sidebar = document.querySelector('.app-shell-left-panel');
    const topFades = [...document.querySelectorAll('.app-shell-main-content-top-fade')];
    const wallpaper = {
      expected: ${expectedWallpaper},
      backgroundImage: bodyBackgroundImage,
      expectedSurfaceBackground,
      mainSurfaceBackground,
      mainSurfaceMatchesVariable: Boolean(mainSurface) &&
        mainSurfaceBackground === expectedSurfaceBackground,
      mainSurfacePresent: Boolean(mainSurface),
      sidebarBridgeTransparent: !sidebar ||
        transparentPaint(getComputedStyle(sidebar, '::after')),
      surfaceVariableConfigured: surfaceVariable.includes('color-mix'),
      terminalSurfacesMatch: terminalSurfaces.every((element) =>
        getComputedStyle(element).backgroundColor === expectedSurfaceBackground),
      topFadeTransparent: topFades.every((element) =>
        transparentPaint(getComputedStyle(element))),
    };
    wallpaper.pass = !wallpaper.expected || (wallpaper.backgroundImage !== '' &&
      wallpaper.backgroundImage !== 'none' && wallpaper.mainSurfacePresent &&
      wallpaper.mainSurfaceMatchesVariable && wallpaper.surfaceVariableConfigured &&
      wallpaper.sidebarBridgeTransparent && wallpaper.terminalSurfacesMatch &&
      wallpaper.topFadeTransparent);
    const expectedSurfaces = Object.values(surfaces).filter((surface) => surface.expected);
    const surfacesPass = expectedSurfaces.every((surface) => surface.pass);
    const hasExpectedLayer = wallpaper.expected || expectedSurfaces.length > 0;
    const result = {
      href: location.href,
      enabled: document.documentElement.dataset.codexSkin === 'enabled',
      stylePresent: Boolean(style),
      hashMatches: style?.dataset.codexSkinHash === ${serializedHash},
      surfaces,
      wallpaper,
      surfacePresent: expectedSurfaces.every((surface) => surface.present),
      backgroundImage: surfacesPass ? 'active' : 'none',
      pointerEvents: expectedSurfaces.every((surface) => surface.pointerEvents === 'none')
        ? 'none'
        : '',
    };
    return {
      ...result,
      pass: result.enabled && result.stylePresent && result.hashMatches && hasExpectedLayer &&
        surfacesPass && wallpaper.pass,
    };
  })()`
}

function runtimeValue(response: RuntimeEvaluateResponse) {
  if (response.exceptionDetails) {
    const detail =
      response.exceptionDetails.exception?.description ||
      response.exceptionDetails.text ||
      "Unknown renderer exception."
    throw new Error(`Renderer evaluation failed: ${detail}`)
  }
  return response.result?.value
}

export async function evaluateOnConnection<Result>(connection: CdpConnection, expression: string) {
  const response = await connection.call<RuntimeEvaluateResponse>("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return runtimeValue(response) as Result
}

export function buildRemovalExpression() {
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID)
  return `(() => {
    window.__codexSkinCleanup?.();
    delete window.__codexSkinCleanup;
    document.getElementById(${serializedId})?.remove();
    delete document.documentElement.dataset.codexSkin;
    return { installed: false, href: location.href };
  })()`
}

export async function evaluateOnTarget(
  target: CdpTarget,
  expression: string,
  options: CdpOptions & { port: number },
) {
  const connection = new CdpConnection(validatedDebuggerUrl(target, options.port), options)
  await connection.connect()
  try {
    return await evaluateOnConnection(connection, expression)
  } finally {
    connection.close()
  }
}

type InjectionOptions = CdpDiscoveryOptions & CdpOptions

const buildTargetProbeExpression = () => `(() => {
  const href = location.href;
  return href.startsWith('app://-/index.html') &&
    !href.includes('initialRoute=%2Favatar-overlay');
})()`

/** Maintains one CDP session per Codex window and reapplies CSS immediately after reloads. */
export class TargetSessionManager {
  private readonly sessions = new Map<string, TargetSession>()
  private css = ""
  private expression = ""
  private readonly options: TargetSessionManagerOptions

  constructor(options: TargetSessionManagerOptions) {
    this.options = options
  }

  async synchronize(css: string): Promise<InjectionResult[]> {
    this.css = css
    this.expression = buildInjectionExpression(css)
    const { fetchImpl, host = "127.0.0.1", port } = this.options
    const targets = await listPageTargets({ fetchImpl, host, port })
    const targetKeys = new Set(targets.map((target) => this.targetKey(target)))

    for (const [key, session] of this.sessions) {
      if (!targetKeys.has(key) || !session.connection.connected) {
        session.connection.close()
        this.sessions.delete(key)
      }
    }

    const results: InjectionResult[] = []
    for (const target of targets) {
      try {
        await this.synchronizeTarget(target)
        results.push({ id: target.id, ok: true, title: target.title, url: target.url })
      } catch (error) {
        results.push({
          id: target.id,
          ok: false,
          error: errorMessage(error),
          title: target.title,
          url: target.url,
        })
      }
    }
    return results
  }

  close() {
    for (const { connection } of this.sessions.values()) connection.close()
    this.sessions.clear()
  }

  private targetKey(target: CdpTarget) {
    return target.id || validatedDebuggerUrl(target, this.options.port)
  }

  private async synchronizeTarget(target: CdpTarget) {
    const key = this.targetKey(target)
    let session = this.sessions.get(key)
    if (!session) {
      const connection = new CdpConnection(
        validatedDebuggerUrl(target, this.options.port),
        this.options,
      )
      await connection.connect()
      try {
        await connection.call("Runtime.enable")
        await connection.call("Page.enable")
        const accepted = await evaluateOnConnection<boolean>(
          connection,
          buildTargetProbeExpression(),
        )
        if (!accepted)
          throw new Error("Rejected a renderer that did not identify as a Codex window.")
        connection.on("Page.loadEventFired", () => {
          setTimeout(() => {
            evaluateOnConnection(connection, this.expression).catch((error) => {
              this.options.onError?.(error instanceof Error ? error : new Error(String(error)))
            })
          }, 150)
        })
        session = { connection, cssHash: "", target }
        this.sessions.set(key, session)
      } catch (error) {
        connection.close()
        throw error
      }
    }

    const hash = backgroundCssHash(this.css)
    if (session.cssHash === hash) {
      const currentStyleMatches = await evaluateOnConnection<boolean>(
        session.connection,
        buildStyleHashProbeExpression(hash),
      )
      if (currentStyleMatches) return
    }
    await evaluateOnConnection(session.connection, this.expression)
    session.cssHash = hash
  }
}

export async function injectAllTargets({
  css,
  host = "127.0.0.1",
  port,
  ...options
}: InjectionOptions & { css: string }): Promise<InjectionResult[]> {
  const targets = await listPageTargets({ host, port, fetchImpl: options.fetchImpl })
  const expression = buildInjectionExpression(css)
  const results: InjectionResult[] = []
  for (const target of targets) {
    try {
      await evaluateOnTarget(target, expression, { ...options, port })
      results.push({ id: target.id, ok: true, title: target.title, url: target.url })
    } catch (error) {
      results.push({
        id: target.id,
        ok: false,
        error: errorMessage(error),
        title: target.title,
        url: target.url,
      })
    }
  }
  return results
}

export async function removeFromAllTargets({
  host = "127.0.0.1",
  port,
  ...options
}: InjectionOptions) {
  const targets = await listPageTargets({ host, port, fetchImpl: options.fetchImpl })
  const expression = buildRemovalExpression()
  for (const target of targets) {
    await evaluateOnTarget(target, expression, { ...options, port }).catch(() => undefined)
  }
  return targets.length
}

export async function verifyAllTargets({
  css,
  host = "127.0.0.1",
  port,
  reload = false,
  timeoutMs = 5000,
  ...options
}: InjectionOptions & { css: string; reload?: boolean }): Promise<TargetVerification[]> {
  const targets = await listPageTargets({ host, port, fetchImpl: options.fetchImpl })
  const expression = buildVerificationExpression(css)
  const results: TargetVerification[] = []

  for (const target of targets) {
    const connection = new CdpConnection(validatedDebuggerUrl(target, port), options)
    try {
      await connection.connect()
      if (reload) {
        await connection.call("Page.enable")
        await connection.call("Page.reload", { ignoreCache: true })
      }
      const deadline = Date.now() + timeoutMs
      let verification: BackgroundVerification | undefined
      let lastError: unknown
      while (Date.now() < deadline) {
        try {
          verification = await evaluateOnConnection<BackgroundVerification>(connection, expression)
          if (verification.pass) break
        } catch (error) {
          lastError = error
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 200))
      }
      if (!verification) throw lastError || new Error("Unable to inspect the Codex renderer.")
      results.push({ ...verification, id: target.id, title: target.title, url: target.url })
    } catch (error) {
      results.push({
        backgroundImage: "",
        enabled: false,
        error: errorMessage(error),
        hashMatches: false,
        href: target.url || "",
        id: target.id,
        pass: false,
        pointerEvents: "",
        stylePresent: false,
        surfacePresent: false,
        surfaces: {
          main: {
            backgroundImage: "",
            expected: false,
            pass: false,
            pointerEvents: "",
            present: false,
          },
          sidebar: {
            backgroundImage: "",
            expected: false,
            pass: false,
            pointerEvents: "",
            present: false,
          },
        },
        wallpaper: {
          backgroundImage: "",
          expected: false,
          expectedSurfaceBackground: "",
          mainSurfaceBackground: "",
          mainSurfaceMatchesVariable: false,
          mainSurfacePresent: false,
          pass: false,
          sidebarBridgeTransparent: false,
          surfaceVariableConfigured: false,
          terminalSurfacesMatch: false,
          topFadeTransparent: false,
        },
        title: target.title,
        url: target.url,
      })
    } finally {
      connection.close()
    }
  }
  return results
}
