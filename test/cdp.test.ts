import assert from "node:assert/strict"
import http from "node:http"
import type { AddressInfo } from "node:net"

import { test } from "vitest"

import { CdpConnection, listPageTargets, validatedDebuggerUrl } from "../src/runtime/cdp.ts"

test("listPageTargets returns injectable pages only", async () => {
  const server = http.createServer((request, response) => {
    const { port } = server.address() as AddressInfo
    response.setHeader("content-type", "application/json")
    response.end(
      JSON.stringify([
        {
          id: "main",
          type: "page",
          url: "app://-/index.html",
          webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/main`,
        },
        {
          id: "external",
          type: "page",
          url: "app://-/index.html",
          webSocketDebuggerUrl: "ws://example.com/devtools/page/external",
        },
        {
          id: "settings",
          type: "page",
          url: "http://127.0.0.1:5000/",
          webSocketDebuggerUrl: "ws://settings",
        },
        {
          id: "pet",
          type: "page",
          url: "app://-/index.html?initialRoute=%2Favatar-overlay",
          webSocketDebuggerUrl: "ws://pet",
        },
        {
          id: "devtools",
          type: "page",
          url: "devtools://devtools",
          webSocketDebuggerUrl: "ws://devtools",
        },
        {
          id: "worker",
          type: "worker",
          url: "file:///worker.js",
          webSocketDebuggerUrl: "ws://worker",
        },
      ]),
    )
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  try {
    const { port } = server.address() as AddressInfo
    const targets = await listPageTargets({ host: "127.0.0.1", port })
    assert.deepEqual(
      targets.map(({ id }) => id),
      ["main"],
    )
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test("validatedDebuggerUrl accepts only the expected loopback port", () => {
  assert.equal(
    validatedDebuggerUrl({ webSocketDebuggerUrl: "ws://localhost:9229/devtools/page/1" }, 9229),
    "ws://localhost:9229/devtools/page/1",
  )
  assert.throws(
    () => validatedDebuggerUrl({ webSocketDebuggerUrl: "ws://127.0.0.1:9230/page/1" }, 9229),
    /unexpected CDP WebSocket URL/,
  )
  assert.throws(
    () => validatedDebuggerUrl({ webSocketDebuggerUrl: "wss://example.com/page/1" }, 9229),
    /unexpected CDP WebSocket URL/,
  )
})

test("CdpConnection pairs responses with requests", async () => {
  class FakeWebSocket extends EventTarget {
    static OPEN = 1
    readyState = 0
    readonly url: string

    constructor(url: string) {
      super()
      this.url = url
      queueMicrotask(() => {
        this.readyState = FakeWebSocket.OPEN
        this.dispatchEvent(new Event("open"))
      })
    }

    send(payload: string) {
      const request = JSON.parse(payload) as { id: number; method: string }
      queueMicrotask(() => {
        const event = new Event("message")
        Object.defineProperty(event, "data", {
          value: JSON.stringify({ id: request.id, result: { value: request.method } }),
        })
        this.dispatchEvent(event)
      })
    }

    close() {
      this.readyState = 3
      this.dispatchEvent(new Event("close"))
    }
  }

  const connection = new CdpConnection("ws://test", { WebSocketImpl: FakeWebSocket })
  await connection.connect()
  assert.deepEqual(await connection.call("Runtime.evaluate"), { value: "Runtime.evaluate" })
  connection.close()
})

test("CdpConnection surfaces protocol errors", async () => {
  class ErrorWebSocket extends EventTarget {
    static OPEN = 1
    readyState = 0

    constructor() {
      super()
      queueMicrotask(() => {
        this.readyState = ErrorWebSocket.OPEN
        this.dispatchEvent(new Event("open"))
      })
    }

    send(payload: string) {
      const { id } = JSON.parse(payload) as { id: number }
      queueMicrotask(() => {
        const event = new Event("message")
        Object.defineProperty(event, "data", {
          value: JSON.stringify({ id, error: { message: "denied" } }),
        })
        this.dispatchEvent(event)
      })
    }

    close() {}
  }

  const connection = new CdpConnection("ws://test", { WebSocketImpl: ErrorWebSocket })
  await connection.connect()
  await assert.rejects(() => connection.call("Runtime.evaluate"), /denied/)
})

test("CdpConnection emits protocol events to persistent sessions", async () => {
  class EventWebSocket extends EventTarget {
    static OPEN = 1
    readyState = 0

    constructor() {
      super()
      queueMicrotask(() => {
        this.readyState = EventWebSocket.OPEN
        this.dispatchEvent(new Event("open"))
      })
    }

    send(payload: string) {
      const { id } = JSON.parse(payload) as { id: number }
      queueMicrotask(() => {
        const response = new Event("message")
        Object.defineProperty(response, "data", { value: JSON.stringify({ id, result: {} }) })
        this.dispatchEvent(response)
        const protocolEvent = new Event("message")
        Object.defineProperty(protocolEvent, "data", {
          value: JSON.stringify({ method: "Page.loadEventFired", params: { timestamp: 1 } }),
        })
        this.dispatchEvent(protocolEvent)
      })
    }

    close() {
      this.readyState = 3
    }
  }

  const connection = new CdpConnection("ws://test", { WebSocketImpl: EventWebSocket })
  const events: unknown[] = []
  connection.on("Page.loadEventFired", (params) => events.push(params))
  await connection.connect()
  await connection.call("Page.enable")
  await new Promise<void>((resolve) => queueMicrotask(resolve))
  assert.deepEqual(events, [{ timestamp: 1 }])
  connection.close()
})
