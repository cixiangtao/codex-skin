import assert from "node:assert/strict"

import { test } from "vitest"

import {
  BACKGROUND_STYLE_ID,
  TargetSessionManager,
  buildInjectionExpression,
  buildRemovalExpression,
  evaluateOnTarget,
} from "../src/runtime/injector.ts"

test("buildInjectionExpression is idempotent and preserves arbitrary CSS", () => {
  const expression = buildInjectionExpression("body::before { content: `</style>`; }")
  assert.match(expression, new RegExp(BACKGROUND_STYLE_ID))
  assert.match(expression, /MutationObserver/)
  assert.match(expression, /setTimeout/)
  assert.match(expression, /textContent/)
  assert.match(expression, /<\\\/style>/)
})

test("evaluateOnTarget surfaces renderer exceptions", async () => {
  class ExceptionWebSocket extends EventTarget {
    static OPEN = 1
    readyState = 0

    constructor() {
      super()
      queueMicrotask(() => {
        this.readyState = ExceptionWebSocket.OPEN
        this.dispatchEvent(new Event("open"))
      })
    }

    send(payload: string) {
      const { id } = JSON.parse(payload) as { id: number }
      queueMicrotask(() => {
        const event = new Event("message")
        Object.defineProperty(event, "data", {
          value: JSON.stringify({
            id,
            result: { exceptionDetails: { text: "ReferenceError: broken" } },
          }),
        })
        this.dispatchEvent(event)
      })
    }

    close() {
      this.readyState = 3
    }
  }

  await assert.rejects(
    () =>
      evaluateOnTarget(
        { webSocketDebuggerUrl: "ws://127.0.0.1:9229/devtools/page/1" },
        "broken()",
        { port: 9229, WebSocketImpl: ExceptionWebSocket },
      ),
    /Renderer evaluation failed: ReferenceError: broken/,
  )
})

test("TargetSessionManager reuses sessions and reinjects after reload", async () => {
  class PersistentWebSocket extends EventTarget {
    static OPEN = 1
    static instance: PersistentWebSocket | undefined
    readyState = 0
    injectionCount = 0

    constructor() {
      super()
      PersistentWebSocket.instance = this
      queueMicrotask(() => {
        this.readyState = PersistentWebSocket.OPEN
        this.dispatchEvent(new Event("open"))
      })
    }

    send(payload: string) {
      const request = JSON.parse(payload) as {
        id: number
        method: string
        params?: { expression?: string }
      }
      const probe = request.params?.expression?.includes("href.startsWith")
      if (request.method === "Runtime.evaluate" && !probe) this.injectionCount += 1
      queueMicrotask(() => {
        const event = new Event("message")
        Object.defineProperty(event, "data", {
          value: JSON.stringify({
            id: request.id,
            result:
              request.method === "Runtime.evaluate"
                ? { result: { value: probe ? true : { installed: true } } }
                : {},
          }),
        })
        this.dispatchEvent(event)
      })
    }

    emitReload() {
      const event = new Event("message")
      Object.defineProperty(event, "data", {
        value: JSON.stringify({ method: "Page.loadEventFired", params: {} }),
      })
      this.dispatchEvent(event)
    }

    close() {
      this.readyState = 3
    }
  }

  const fetchImpl = async () =>
    new Response(
      JSON.stringify([
        {
          id: "main",
          type: "page",
          title: "Codex",
          url: "app://-/index.html",
          webSocketDebuggerUrl: "ws://127.0.0.1:9229/devtools/page/main",
        },
      ]),
      { headers: { "content-type": "application/json" } },
    )
  const manager = new TargetSessionManager({
    fetchImpl: fetchImpl as typeof fetch,
    port: 9229,
    WebSocketImpl: PersistentWebSocket,
  })
  await manager.synchronize("body { color: red; }")
  await manager.synchronize("body { color: red; }")
  assert.equal(PersistentWebSocket.instance?.injectionCount, 1)

  PersistentWebSocket.instance?.emitReload()
  await new Promise<void>((resolve) => setTimeout(resolve, 180))
  assert.equal(PersistentWebSocket.instance?.injectionCount, 2)
  manager.close()
})

test("buildRemovalExpression removes the style and observer", () => {
  const expression = buildRemovalExpression()
  assert.match(expression, /remove\(\)/)
  assert.match(expression, /codexBackgroundCleanup/)
})
