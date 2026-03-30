import type { CdpTarget } from "./types.ts"

const DEFAULT_TIMEOUT_MS = 5000

interface WebSocketLike {
  readyState: number
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ): void
  close(): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void
  send(payload: string): void
}

interface WebSocketConstructor {
  readonly OPEN: number
  new (url: string): WebSocketLike
}

interface PendingCall {
  reject: (error: Error) => void
  resolve: (value: unknown) => void
  timer: ReturnType<typeof setTimeout>
}

interface CdpMessage {
  error?: { message?: string }
  id?: number
  method?: string
  params?: unknown
  result?: unknown
}

type CdpEventListener = (params: unknown) => void

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"])

export interface CdpOptions {
  WebSocketImpl?: WebSocketConstructor
  timeoutMs?: number
}

export interface CdpDiscoveryOptions {
  fetchImpl?: typeof fetch
  host?: string
  port: number
}

/** Validates that a target cannot redirect the client away from the expected loopback endpoint. */
export function validatedDebuggerUrl(target: CdpTarget, port: number) {
  if (!target.webSocketDebuggerUrl) throw new Error("CDP target has no debugger URL.")
  const url = new URL(target.webSocketDebuggerUrl)
  if (url.protocol !== "ws:" || !LOOPBACK_HOSTS.has(url.hostname) || Number(url.port) !== port) {
    throw new Error(`Rejected unexpected CDP WebSocket URL: ${url.href}`)
  }
  return url.href
}

export function isCodexWindowTarget(target: CdpTarget) {
  if (target.type !== "page" || typeof target.webSocketDebuggerUrl !== "string") return false
  const url = String(target.url || "")
  if (!url.startsWith("app://-/index.html")) return false
  return !url.includes("initialRoute=%2Favatar-overlay")
}

export async function listPageTargets({
  host = "127.0.0.1",
  port,
  fetchImpl = fetch,
}: CdpDiscoveryOptions) {
  const response = await fetchImpl(`http://${host}:${port}/json/list`, {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`CDP target discovery failed with HTTP ${response.status}.`)
  const targets = (await response.json()) as unknown
  if (!Array.isArray(targets)) throw new Error("CDP target discovery returned an invalid payload.")
  return (targets as CdpTarget[]).filter((target) => {
    if (!isCodexWindowTarget(target)) return false
    try {
      validatedDebuggerUrl(target, port)
      return true
    } catch {
      return false
    }
  })
}

export async function isCdpAvailable({
  host = "127.0.0.1",
  port,
  fetchImpl = fetch,
}: CdpDiscoveryOptions) {
  try {
    const response = await fetchImpl(`http://${host}:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

export class CdpConnection {
  readonly url: string
  readonly WebSocketImpl: WebSocketConstructor
  readonly timeoutMs: number
  private nextId = 1
  private readonly pending = new Map<number, PendingCall>()
  private readonly listeners = new Map<string, Set<CdpEventListener>>()
  private socket: WebSocketLike | null = null

  get connected() {
    return this.socket?.readyState === this.WebSocketImpl.OPEN
  }

  constructor(url: string, options: CdpOptions = {}) {
    this.url = url
    this.WebSocketImpl =
      options.WebSocketImpl || (globalThis.WebSocket as unknown as WebSocketConstructor)
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  }

  async connect() {
    if (!this.WebSocketImpl) throw new Error("This Node.js runtime does not provide WebSocket.")
    if (this.socket) return
    const socket = new this.WebSocketImpl(this.url)
    this.socket = socket
    socket.addEventListener("message", (event) => this.handleMessage(event as MessageEvent))
    socket.addEventListener("close", () => this.rejectPending(new Error("CDP connection closed.")))
    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        socket.removeEventListener("error", onError)
        resolve()
      }
      const onError = () => {
        socket.removeEventListener("open", onOpen)
        reject(new Error(`Unable to connect to CDP target: ${this.url}`))
      }
      socket.addEventListener("open", onOpen, { once: true })
      socket.addEventListener("error", onError, { once: true })
    })
  }

  async call<Result = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<Result> {
    if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
      throw new Error("CDP connection is not open.")
    }
    const id = this.nextId++
    return await new Promise<Result>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP call timed out: ${method}`))
      }, this.timeoutMs)
      this.pending.set(id, {
        resolve: (value) => resolve(value as Result),
        reject,
        timer,
      })
      this.socket?.send(JSON.stringify({ id, method, params }))
    })
  }

  close() {
    this.socket?.close()
    this.socket = null
  }

  on(method: string, listener: CdpEventListener) {
    const listeners = this.listeners.get(method) || new Set<CdpEventListener>()
    listeners.add(listener)
    this.listeners.set(method, listeners)
    return () => listeners.delete(listener)
  }

  private handleMessage(event: MessageEvent) {
    let message: CdpMessage
    try {
      message = JSON.parse(String(event.data)) as CdpMessage
    } catch {
      return
    }
    if (!message.id) {
      if (!message.method) return
      for (const listener of this.listeners.get(message.method) || []) listener(message.params)
      return
    }
    const pending = this.pending.get(message.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(message.id)
    if (message.error) pending.reject(new Error(message.error.message || "CDP protocol error."))
    else pending.resolve(message.result)
  }

  private rejectPending(error: Error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer)
      reject(error)
    }
    this.pending.clear()
  }
}
