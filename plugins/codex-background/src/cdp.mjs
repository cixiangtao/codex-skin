const DEFAULT_TIMEOUT_MS = 5000;

export function isCodexWindowTarget(target) {
  if (target?.type !== "page" || typeof target.webSocketDebuggerUrl !== "string") return false;
  const url = String(target.url || "");
  if (!url.startsWith("app://-/index.html")) return false;
  return !url.includes("initialRoute=%2Favatar-overlay");
}

export async function listPageTargets({ host = "127.0.0.1", port, fetchImpl = fetch } = {}) {
  if (!port) throw new Error("A CDP port is required.");
  const response = await fetchImpl(`http://${host}:${port}/json/list`, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CDP target discovery failed with HTTP ${response.status}.`);
  const targets = await response.json();
  if (!Array.isArray(targets)) throw new Error("CDP target discovery returned an invalid payload.");
  return targets.filter(isCodexWindowTarget);
}

export async function isCdpAvailable({ host = "127.0.0.1", port, fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(`http://${host}:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export class CdpConnection {
  constructor(url, options = {}) {
    this.url = url;
    this.WebSocketImpl = options.WebSocketImpl || globalThis.WebSocket;
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
    this.nextId = 1;
    this.pending = new Map();
    this.socket = null;
  }

  async connect() {
    if (!this.WebSocketImpl) throw new Error("This Node.js runtime does not provide WebSocket.");
    if (this.socket) return;
    const socket = new this.WebSocketImpl(this.url);
    this.socket = socket;
    socket.addEventListener("message", (event) => this.#handleMessage(event));
    socket.addEventListener("close", () => this.#rejectPending(new Error("CDP connection closed.")));
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        socket.removeEventListener("open", onOpen);
        reject(new Error(`Unable to connect to CDP target: ${this.url}`));
      };
      socket.addEventListener("open", onOpen, { once: true });
      socket.addEventListener("error", onError, { once: true });
    });
  }

  async call(method, params = {}) {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
      throw new Error("CDP connection is not open.");
    }
    const id = this.nextId++;
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP call timed out: ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }

  #handleMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message || "CDP protocol error."));
    else pending.resolve(message.result);
  }

  #rejectPending(error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }
}
