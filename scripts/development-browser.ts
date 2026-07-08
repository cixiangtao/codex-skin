import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

const SCRIPTABLE_BROWSERS = [
  { kind: "chromium", name: "Google Chrome" },
  { kind: "chromium", name: "Google Chrome Canary" },
  { kind: "chromium", name: "Microsoft Edge" },
  { kind: "chromium", name: "Brave Browser" },
  { kind: "chromium", name: "Chromium" },
  { kind: "safari", name: "Safari" },
] as const

type BrowserKind = (typeof SCRIPTABLE_BROWSERS)[number]["kind"]

interface OpenDevelopmentUiOptions {
  listRunningApplicationsImpl?: () => Promise<Set<string>>
  openUrlImpl?: (url: string) => void
  runAppleScriptImpl?: (source: string) => Promise<string>
}

function appleScriptString(value: string) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

function reuseTabScript(
  kind: BrowserKind,
  applicationName: string,
  uiUrl: string,
  bootstrapUrl: string,
) {
  const application = appleScriptString(applicationName)
  const uiPrefix = appleScriptString(uiUrl)
  const bootstrap = appleScriptString(bootstrapUrl)

  if (kind === "safari") {
    return `
tell application ${application}
  repeat with browserWindow in windows
    repeat with browserTab in tabs of browserWindow
      if URL of browserTab starts with ${uiPrefix} then
        set URL of browserTab to ${bootstrap}
        set current tab of browserWindow to browserTab
        set index of browserWindow to 1
        activate
        return "reused"
      end if
    end repeat
  end repeat
end tell
return "not-found"
`.trim()
  }

  return `
tell application ${application}
  repeat with browserWindow in windows
    repeat with tabIndex from 1 to count tabs of browserWindow
      set browserTab to tab tabIndex of browserWindow
      if URL of browserTab starts with ${uiPrefix} then
        set URL of browserTab to ${bootstrap}
        set active tab index of browserWindow to tabIndex
        set index of browserWindow to 1
        activate
        return "reused"
      end if
    end repeat
  end repeat
end tell
return "not-found"
`.trim()
}

async function listRunningApplications() {
  const source = `
tell application "System Events"
  set applicationNames to name of every application process whose background only is false
  set AppleScript's text item delimiters to linefeed
  return applicationNames as text
end tell
`.trim()
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", source])
  return new Set(stdout.split(/\r?\n/u).filter(Boolean))
}

async function runAppleScript(source: string) {
  const { stdout } = await execFileAsync("/usr/bin/osascript", ["-e", source])
  return stdout.trim()
}

function openUrl(url: string) {
  spawn("open", [url], { detached: true, stdio: "ignore" }).unref()
}

/** Reauthenticates and focuses an existing dev UI tab, or opens one when none exists. */
export async function openDevelopmentUi(
  bootstrapUrl: string,
  uiUrl: string,
  options: OpenDevelopmentUiOptions = {},
) {
  const runningApplications = await (
    options.listRunningApplicationsImpl || listRunningApplications
  )().catch(() => new Set<string>())
  const execute = options.runAppleScriptImpl || runAppleScript

  for (const browser of SCRIPTABLE_BROWSERS) {
    if (!runningApplications.has(browser.name)) continue
    const result = await execute(
      reuseTabScript(browser.kind, browser.name, uiUrl, bootstrapUrl),
    ).catch(() => "not-found")
    if (result === "reused") return "reused" as const
  }

  const launch = options.openUrlImpl || openUrl
  launch(bootstrapUrl)
  return "opened" as const
}
