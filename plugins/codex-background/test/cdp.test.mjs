import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { CdpConnection, listPageTargets } from "../src/cdp.mjs";

test("listPageTargets returns injectable pages only", async () => {
  const server = http.createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify([
        { id: "main", type: "page", url: "app://-/index.html", webSocketDebuggerUrl: "ws://main" },
        { id: "settings", type: "page", url: "http://127.0.0.1:5000/", webSocketDebuggerUrl: "ws://settings" },
        { id: "pet", type: "page", url: "app://-/index.html?initialRoute=%2Favatar-overlay", webSocketDebuggerUrl: "ws://pet" },
        { id: "devtools", type: "page", url: "devtools://devtools", webSocketDebuggerUrl: "ws://devtools" },
        { id: "worker", type: "worker", url: "file:///worker.js", webSocketDebuggerUrl: "ws://worker" },
      ]),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address();
    const targets = await listPageTargets({ host: "127.0.0.1", port });
    assert.deepEqual(targets.map(({ id }) => id), ["main"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("CdpConnection pairs responses with requests", async () => {
  class FakeWebSocket extends EventTarget {
    static OPEN = 1;
    readyState = 0;

    constructor(url) {
      super();
      this.url = url;
      queueMicrotask(() => {
        this.readyState = FakeWebSocket.OPEN;
        this.dispatchEvent(new Event("open"));
      });
    }

    send(payload) {
      const request = JSON.parse(payload);
      queueMicrotask(() => {
        const event = new Event("message");
        Object.defineProperty(event, "data", {
          value: JSON.stringify({ id: request.id, result: { value: request.method } }),
        });
        this.dispatchEvent(event);
      });
    }

    close() {
      this.readyState = 3;
      this.dispatchEvent(new Event("close"));
    }
  }

  const connection = new CdpConnection("ws://test", { WebSocketImpl: FakeWebSocket });
  await connection.connect();
  assert.deepEqual(await connection.call("Runtime.evaluate"), { value: "Runtime.evaluate" });
  connection.close();
});

test("CdpConnection surfaces protocol errors", async () => {
  class ErrorWebSocket extends EventTarget {
    static OPEN = 1;
    readyState = 0;

    constructor() {
      super();
      queueMicrotask(() => {
        this.readyState = ErrorWebSocket.OPEN;
        this.dispatchEvent(new Event("open"));
      });
    }

    send(payload) {
      const { id } = JSON.parse(payload);
      queueMicrotask(() => {
        const event = new Event("message");
        Object.defineProperty(event, "data", {
          value: JSON.stringify({ id, error: { message: "denied" } }),
        });
        this.dispatchEvent(event);
      });
    }

    close() {}
  }

  const connection = new CdpConnection("ws://test", { WebSocketImpl: ErrorWebSocket });
  await connection.connect();
  await assert.rejects(() => connection.call("Runtime.evaluate"), /denied/);
});
