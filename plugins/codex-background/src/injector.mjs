import { CdpConnection, listPageTargets } from "./cdp.mjs";

export const BACKGROUND_STYLE_ID = "codex-background-style";

function serializeForJavaScript(value) {
  return JSON.stringify(value).replaceAll("</", "<\\/");
}

export function buildInjectionExpression(css) {
  const serializedCss = serializeForJavaScript(css);
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID);
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
  })()`;
}

export function buildRemovalExpression() {
  const serializedId = serializeForJavaScript(BACKGROUND_STYLE_ID);
  return `(() => {
    window.__codexBackgroundCleanup?.();
    delete window.__codexBackgroundCleanup;
    document.getElementById(${serializedId})?.remove();
    delete document.documentElement.dataset.codexBackground;
    return { installed: false, href: location.href };
  })()`;
}

export async function evaluateOnTarget(target, expression, options = {}) {
  const connection = new CdpConnection(target.webSocketDebuggerUrl, options);
  await connection.connect();
  try {
    return await connection.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
  } finally {
    connection.close();
  }
}

export async function injectAllTargets({ css, host = "127.0.0.1", port, ...options }) {
  const targets = await listPageTargets({ host, port, fetchImpl: options.fetchImpl });
  const expression = buildInjectionExpression(css);
  const results = [];
  for (const target of targets) {
    try {
      await evaluateOnTarget(target, expression, options);
      results.push({ id: target.id, ok: true, title: target.title, url: target.url });
    } catch (error) {
      results.push({ id: target.id, ok: false, error: error.message, title: target.title, url: target.url });
    }
  }
  return results;
}

export async function removeFromAllTargets({ host = "127.0.0.1", port, ...options }) {
  const targets = await listPageTargets({ host, port, fetchImpl: options.fetchImpl });
  const expression = buildRemovalExpression();
  for (const target of targets) {
    await evaluateOnTarget(target, expression, options).catch(() => undefined);
  }
  return targets.length;
}
