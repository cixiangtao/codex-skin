import assert from "node:assert/strict"

import { test } from "vitest"

import { openDevelopmentUi } from "../scripts/development-browser.ts"

const bootstrapUrl = "http://127.0.0.1:4179/?token=development-token"
const uiUrl = "http://127.0.0.1:4178/"

test("openDevelopmentUi reauthenticates and focuses an existing tab", async () => {
  const scripts: string[] = []
  const openedUrls: string[] = []

  const result = await openDevelopmentUi(bootstrapUrl, uiUrl, {
    listRunningApplicationsImpl: async () => new Set(["Google Chrome"]),
    openUrlImpl: (url) => openedUrls.push(url),
    runAppleScriptImpl: async (source) => {
      scripts.push(source)
      return "reused"
    },
  })

  assert.equal(result, "reused")
  assert.deepEqual(openedUrls, [])
  assert.equal(scripts.length, 1)
  assert.match(scripts[0] || "", /Google Chrome/)
  assert.match(scripts[0] || "", /http:\/\/127\.0\.0\.1:4178\//)
  assert.match(scripts[0] || "", /http:\/\/127\.0\.0\.1:4179\/\?token=development-token/)
})

test("openDevelopmentUi falls back to the default browser when no tab matches", async () => {
  const openedUrls: string[] = []

  const result = await openDevelopmentUi(bootstrapUrl, uiUrl, {
    listRunningApplicationsImpl: async () => new Set(["Google Chrome"]),
    openUrlImpl: (url) => openedUrls.push(url),
    runAppleScriptImpl: async () => "not-found",
  })

  assert.equal(result, "opened")
  assert.deepEqual(openedUrls, [bootstrapUrl])
})

test("openDevelopmentUi skips browsers that are not running", async () => {
  let scriptRuns = 0

  await openDevelopmentUi(bootstrapUrl, uiUrl, {
    listRunningApplicationsImpl: async () => new Set(["Code"]),
    openUrlImpl: () => undefined,
    runAppleScriptImpl: async () => {
      scriptRuns += 1
      return "reused"
    },
  })

  assert.equal(scriptRuns, 0)
})
