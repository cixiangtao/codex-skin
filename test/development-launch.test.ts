import assert from "node:assert/strict"
import path from "node:path"

import { test } from "vitest"

import { launchDevelopmentRuntime } from "../scripts/development-launch.ts"

test("development launch reuses the default CLI launch path and development settings server", async () => {
  const events: string[] = []
  const exitCode = await launchDevelopmentRuntime({
    apiPid: 41790,
    bootstrapUrl: "http://127.0.0.1:4179/?token=test",
    log: (message) => events.push(message),
    openDevelopmentUiImpl: async () => "reused",
    runCliImpl: async (argv, options) => {
      assert.deepEqual(argv, [])
      assert.equal(options.entryPath, path.resolve("bin/codex-skin.ts"))
      assert.deepEqual(await options.openSettingsImpl?.("ignored"), {
        pid: 41790,
        port: 4179,
        url: "http://127.0.0.1:4179/?token=test",
      })
      return 0
    },
    uiUrl: "http://127.0.0.1:4178/",
  })

  assert.equal(exitCode, 0)
  assert.deepEqual(events, ["Development UI: http://127.0.0.1:4178/ (reused existing browser tab)"])
})
