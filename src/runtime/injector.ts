import { CdpConnection, listPageTargets } from "./cdp.ts"
import type { CdpOptions, CdpDiscoveryOptions } from "./cdp.ts"
import type { CdpTarget, InjectionResult } from "./types.ts"
import { errorMessage } from "./types.ts"

export const BACKGROUND_STYLE_ID = "codex-background-style"

function serializeForJavaScript(value: string) {
  return JSON.stringify(value).replaceAll("</", "<\\/")
}

export function buildInjectionExpression(css: string) {
  const serializedCss = serializeForJavaScript(css)
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID)
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
    };
    window.__codexBackgroundCleanup?.();
    install();
    const observer = new MutationObserver(install);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__codexBackgroundCleanup = () => observer.disconnect();
    document.documentElement.dataset.codexBackground = "enabled";
    return { installed: true, styleId, href: location.href };
  })()`
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
  options: CdpOptions = {},
) {
  if (!target.webSocketDebuggerUrl) throw new Error("CDP target has no debugger URL.")
  const connection = new CdpConnection(target.webSocketDebuggerUrl, options)
  await connection.connect()
  try {
    return await connection.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
  } finally {
    connection.close()
  }
}

type InjectionOptions = CdpDiscoveryOptions & CdpOptions

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
      await evaluateOnTarget(target, expression, options)
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
    await evaluateOnTarget(target, expression, options).catch(() => undefined)
  }
  return targets.length
}
