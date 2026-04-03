import { createHash } from "node:crypto"

import { CdpConnection, listPageTargets, validatedDebuggerUrl } from "./cdp.ts"
import type { CdpOptions, CdpDiscoveryOptions } from "./cdp.ts"
import type { CdpTarget, InjectionResult } from "./types.ts"
import { errorMessage } from "./types.ts"

export const BACKGROUND_STYLE_ID = "codex-background-style"

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
      style.dataset.codexBackgroundHash = ${serializedHash};
    };
    window.__codexBackgroundCleanup?.();
    install();
    let installTimer;
    const scheduleInstall = () => {
      clearTimeout(installTimer);
      installTimer = setTimeout(install, 120);
    };
    const observer = new MutationObserver(scheduleInstall);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__codexBackgroundCleanup = () => {
      observer.disconnect();
      clearTimeout(installTimer);
    };
    document.documentElement.dataset.codexBackground = "enabled";
    return { installed: true, styleId, href: location.href };
  })()`
}

export function buildVerificationExpression(css: string) {
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID)
  const serializedHash = serializeForJavaScript(backgroundCssHash(css))
  return `(() => {
    const style = document.getElementById(${serializedId});
    const surface = document.querySelector('.main-surface, .browser-main-surface');
    const pseudo = surface ? getComputedStyle(surface, '::before') : null;
    const result = {
      href: location.href,
      enabled: document.documentElement.dataset.codexBackground === 'enabled',
      stylePresent: Boolean(style),
      hashMatches: style?.dataset.codexBackgroundHash === ${serializedHash},
      surfacePresent: Boolean(surface),
      backgroundImage: pseudo?.backgroundImage || '',
      pointerEvents: pseudo?.pointerEvents || '',
    };
    return {
      ...result,
      pass: result.enabled && result.stylePresent && result.hashMatches && result.surfacePresent &&
        result.backgroundImage !== '' && result.backgroundImage !== 'none' &&
        result.pointerEvents === 'none',
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
    window.__codexBackgroundCleanup?.();
    delete window.__codexBackgroundCleanup;
    document.getElementById(${serializedId})?.remove();
    delete document.documentElement.dataset.codexBackground;
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
    if (session.cssHash === hash) return
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
        title: target.title,
        url: target.url,
      })
    } finally {
      connection.close()
    }
  }
  return results
}
