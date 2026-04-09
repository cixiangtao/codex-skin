import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"

const DEVELOPMENT_API_URL = "http://127.0.0.1:4179/"
const DEVELOPMENT_UI_URL = "http://127.0.0.1:4178/"
const STARTUP_TIMEOUT_MS = 10_000

async function waitForServer(url: string) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(500) })
      return
    } catch {
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    }
  }
  throw new Error(`Development server did not become ready: ${url}`)
}

const token = randomBytes(24).toString("hex")
const environment = { ...process.env, CODEX_SKIN_DEV_TOKEN: token }
const children = ["dev:ui", "dev:server"].map((script) => ({
  process: spawn(process.execPath, ["run", script], { env: environment, stdio: "inherit" }),
  script,
}))

let stopping = false
const stopChildren = () => {
  if (stopping) return
  stopping = true
  for (const child of children) child.process.kill("SIGTERM")
}
process.once("SIGINT", stopChildren)
process.once("SIGTERM", stopChildren)

const firstExit = Promise.race(
  children.map(
    ({ process: child, script }) =>
      new Promise<{ code: number | null; script: string; signal: NodeJS.Signals | null }>(
        (resolve) => {
          child.once("exit", (code, signal) => resolve({ code, script, signal }))
        },
      ),
  ),
)

try {
  await Promise.all([waitForServer(DEVELOPMENT_UI_URL), waitForServer(DEVELOPMENT_API_URL)])
  const bootstrapUrl = `${DEVELOPMENT_API_URL}?token=${token}`
  spawn("open", [bootstrapUrl], { detached: true, stdio: "ignore" }).unref()
  console.log(`Development UI: ${DEVELOPMENT_UI_URL}`)
} catch (error) {
  stopChildren()
  throw error
}

const result = await firstExit
stopChildren()
if (!result.signal && result.code) {
  throw new Error(`${result.script} exited with code ${result.code}.`)
}
