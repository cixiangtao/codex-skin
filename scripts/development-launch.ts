import path from "node:path"

import { runCli } from "../src/runtime/cli.ts"
import { openDevelopmentUi } from "./development-browser.ts"

interface DevelopmentLaunchOptions {
  apiPid: number
  bootstrapUrl: string
  log?: (message: string) => void
  openDevelopmentUiImpl?: typeof openDevelopmentUi
  runCliImpl?: typeof runCli
  uiUrl: string
}

/** Starts the development runtime through the same default CLI launch path as the npm command. */
export async function launchDevelopmentRuntime(options: DevelopmentLaunchOptions) {
  const executeCli = options.runCliImpl || runCli
  return await executeCli([], {
    entryPath: path.resolve("bin/codex-skin.ts"),
    openSettingsImpl: async () => {
      const openUi = options.openDevelopmentUiImpl || openDevelopmentUi
      const browserAction = await openUi(options.bootstrapUrl, options.uiUrl)
      const browserStatus =
        browserAction === "reused" ? "reused existing browser tab" : "opened new browser tab"
      const log = options.log || console.log
      log(`Development UI: ${options.uiUrl} (${browserStatus})`)
      return { pid: options.apiPid, port: 4179, url: options.bootstrapUrl }
    },
  })
}
