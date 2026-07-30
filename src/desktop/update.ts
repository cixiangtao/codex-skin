import { createHash } from "node:crypto"
import { access, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const AUTOMATIC_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const AUTOMATIC_CHECK_INITIAL_DELAY_MS = 12_000
const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/cixiangtao/codex-skin/releases?per_page=20"
const UPDATE_STATE_FILE = "desktop-update-state.json"

declare const __CODEX_SKIN_DESKTOP_RELEASE_TAG__: string

interface DesktopReleaseVersion {
  major: number
  minor: number
  patch: number
  preview: number | null
}

interface GitHubAsset {
  downloadUrl: string
  name: string
}

interface UpdateState {
  ignoredTag: string | null
  lastCheckedAtMs: number | null
}

interface UpdateDialogOptions {
  buttons?: string[]
  cancelId?: number
  defaultId?: number
  detail?: string
  message: string
  title?: string
  type?: "error" | "info" | "none" | "question" | "warning"
}

type FetchUpdates = (input: string, init?: RequestInit) => Promise<Response>

export interface DesktopUpdateRelease {
  checksumAsset: GitHubAsset
  displayVersion: string
  dmgAsset: GitHubAsset
  publishedAt: string | null
  releaseNotes: string
  releaseUrl: string
  tag: string
}

export interface DesktopUpdateController {
  checkForUpdates(options?: { manual?: boolean }): Promise<void>
  destroy(): Promise<void>
  getMenuItemState(): { enabled: boolean; label: string }
  startAutomaticChecks(): void
}

interface DesktopUpdateControllerOptions {
  currentTag: string
  dataDirectory: string
  downloadsDirectory: string
  fetchImpl?: FetchUpdates
  initialCheckDelayMs?: number
  now?: () => number
  onStateChange?: () => void
  openPath: (filePath: string) => Promise<string>
  reportError?: (message: string, error: unknown) => void
  setProgress?: (progress: number) => void
  showMessageBox: (options: UpdateDialogOptions) => Promise<{ response: number }>
}

interface DownloadUpdateOptions {
  downloadsDirectory: string
  fetchImpl?: FetchUpdates
  onProgress?: (receivedBytes: number, totalBytes: number | null) => void
  signal?: AbortSignal
}

const DEFAULT_UPDATE_STATE = Object.freeze({
  ignoredTag: null,
  lastCheckedAtMs: null,
} satisfies UpdateState)

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function parseAsset(value: unknown): GitHubAsset | undefined {
  const asset = objectRecord(value)
  if (typeof asset.name !== "string" || typeof asset.browser_download_url !== "string") return
  if (!asset.browser_download_url.startsWith("https://github.com/")) return
  return { downloadUrl: asset.browser_download_url, name: asset.name }
}

/** Parses the stable and preview desktop tag formats used by GitHub Releases. */
export function parseDesktopReleaseTag(tag: string): DesktopReleaseVersion | undefined {
  const match = /^desktop-v(\d+)\.(\d+)\.(\d+)(?:-preview\.(\d+))?$/.exec(tag)
  if (!match) return
  const [, major, minor, patch, preview] = match
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    preview: preview === undefined ? null : Number(preview),
  }
}

/** Returns a positive value when the first desktop release tag is newer. */
export function compareDesktopReleaseTags(firstTag: string, secondTag: string) {
  const first = parseDesktopReleaseTag(firstTag)
  const second = parseDesktopReleaseTag(secondTag)
  if (!first || !second) throw new Error("Unable to compare invalid desktop release tags.")

  for (const key of ["major", "minor", "patch"] as const) {
    if (first[key] !== second[key]) return first[key] - second[key]
  }
  if (first.preview === second.preview) return 0
  if (first.preview === null) return 1
  if (second.preview === null) return -1
  return first.preview - second.preview
}

function formatDesktopVersion(tag: string) {
  const version = parseDesktopReleaseTag(tag)
  if (!version) return tag
  const stableVersion = `${version.major}.${version.minor}.${version.patch}`
  return version.preview === null ? stableVersion : `${stableVersion} Preview ${version.preview}`
}

/** Selects the newest compatible GitHub release that is newer than the packaged build. */
export function selectDesktopUpdateRelease(
  input: unknown,
  currentTag: string,
): DesktopUpdateRelease | null {
  const currentVersion = parseDesktopReleaseTag(currentTag)
  if (!currentVersion || !Array.isArray(input)) return null
  const candidates: DesktopUpdateRelease[] = []

  for (const value of input) {
    const release = objectRecord(value)
    if (release.draft === true || typeof release.tag_name !== "string") continue
    const releaseVersion = parseDesktopReleaseTag(release.tag_name)
    if (!releaseVersion) continue
    if (currentVersion.preview === null && releaseVersion.preview !== null) continue
    if (compareDesktopReleaseTags(release.tag_name, currentTag) <= 0) continue

    const assets = Array.isArray(release.assets)
      ? release.assets.map(parseAsset).filter((asset): asset is GitHubAsset => Boolean(asset))
      : []
    const dmgAsset =
      assets.find((asset) => asset.name.endsWith("-arm64.dmg")) ||
      assets.find((asset) => asset.name.endsWith(".dmg"))
    const checksumAsset = assets.find((asset) => asset.name === "SHA256SUMS.txt")
    if (!dmgAsset || !checksumAsset || typeof release.html_url !== "string") continue

    candidates.push({
      checksumAsset,
      displayVersion: formatDesktopVersion(release.tag_name),
      dmgAsset,
      publishedAt: typeof release.published_at === "string" ? release.published_at : null,
      releaseNotes: typeof release.body === "string" ? release.body : "",
      releaseUrl: release.html_url,
      tag: release.tag_name,
    })
  }

  return (
    candidates.sort((first, second) => compareDesktopReleaseTags(second.tag, first.tag))[0] || null
  )
}

/** Returns the release tag embedded into the Electron main bundle by the release workflow. */
export function currentDesktopReleaseTag() {
  return typeof __CODEX_SKIN_DESKTOP_RELEASE_TAG__ === "string"
    ? __CODEX_SKIN_DESKTOP_RELEASE_TAG__
    : ""
}

async function fetchDesktopUpdate(
  currentTag: string,
  fetchImpl: FetchUpdates,
  signal: AbortSignal,
): Promise<DesktopUpdateRelease | null> {
  const response = await fetchImpl(GITHUB_RELEASES_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "Codex-Skin-Desktop",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  })
  if (!response.ok) {
    throw new Error(`GitHub update request failed with HTTP ${response.status}.`)
  }
  return selectDesktopUpdateRelease(await response.json(), currentTag)
}

function parseChecksumFile(contents: string, fileName: string) {
  for (const line of contents.split(/\r?\n/)) {
    const match = /^([a-f\d]{64})\s+\*?(.+)$/i.exec(line.trim())
    if (match?.[2] === fileName) return match[1]?.toLowerCase()
  }
  throw new Error(`SHA-256 checksum for ${fileName} is missing.`)
}

async function resolveAvailableDownloadPath(directory: string, fileName: string) {
  const safeFileName = path.basename(fileName)
  const extension = path.extname(safeFileName)
  const baseName = safeFileName.slice(0, -extension.length)

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidateName = suffix === 0 ? safeFileName : `${baseName} (${suffix})${extension}`
    const candidatePath = path.join(directory, candidateName)
    try {
      await access(candidatePath)
    } catch {
      return candidatePath
    }
  }
  throw new Error("Unable to reserve a download file name.")
}

/** Downloads a release DMG, verifies its published SHA-256 digest, and returns its final path. */
export async function downloadDesktopUpdate(
  release: DesktopUpdateRelease,
  options: DownloadUpdateOptions,
) {
  const fetchImpl = options.fetchImpl || fetch
  const checksumResponse = await fetchImpl(release.checksumAsset.downloadUrl, {
    signal: options.signal,
  })
  if (!checksumResponse.ok) {
    throw new Error(`Checksum download failed with HTTP ${checksumResponse.status}.`)
  }
  const expectedChecksum = parseChecksumFile(await checksumResponse.text(), release.dmgAsset.name)

  await mkdir(options.downloadsDirectory, { recursive: true })
  const destinationPath = await resolveAvailableDownloadPath(
    options.downloadsDirectory,
    release.dmgAsset.name,
  )
  const now = Date.now()
  const temporaryPath = `${destinationPath}.${process.pid}.${now}.download`
  const response = await fetchImpl(release.dmgAsset.downloadUrl, { signal: options.signal })
  if (!response.ok) throw new Error(`Update download failed with HTTP ${response.status}.`)
  if (!response.body) throw new Error("Update download returned an empty response body.")

  const contentLength = Number(response.headers.get("content-length"))
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null
  const hash = createHash("sha256")
  let receivedBytes = 0
  const file = await open(temporaryPath, "wx", 0o644)

  try {
    for await (const chunk of response.body) {
      const bytes = Buffer.from(chunk)
      await file.writeFile(bytes)
      hash.update(bytes)
      receivedBytes += bytes.byteLength
      options.onProgress?.(receivedBytes, totalBytes)
    }
    await file.sync()
    await file.close()

    const actualChecksum = hash.digest("hex")
    if (actualChecksum !== expectedChecksum) {
      throw new Error("Downloaded update failed SHA-256 verification.")
    }
    await rename(temporaryPath, destinationPath)
    return destinationPath
  } catch (error) {
    await file.close().catch(() => undefined)
    await unlink(temporaryPath).catch(() => undefined)
    throw error
  }
}

function resolveUpdateStatePath(dataDirectory: string) {
  return path.join(dataDirectory, UPDATE_STATE_FILE)
}

async function readUpdateState(dataDirectory: string): Promise<UpdateState> {
  try {
    const source = objectRecord(
      JSON.parse(await readFile(resolveUpdateStatePath(dataDirectory), "utf8")) as unknown,
    )
    return {
      ignoredTag: typeof source.ignoredTag === "string" ? source.ignoredTag : null,
      lastCheckedAtMs:
        typeof source.lastCheckedAtMs === "number" && Number.isFinite(source.lastCheckedAtMs)
          ? source.lastCheckedAtMs
          : null,
    }
  } catch {
    return { ...DEFAULT_UPDATE_STATE }
  }
}

async function writeUpdateState(dataDirectory: string, state: UpdateState) {
  const statePath = resolveUpdateStatePath(dataDirectory)
  const temporaryPath = `${statePath}.${process.pid}.${Date.now()}.tmp`
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
  await rename(temporaryPath, statePath)
}

function releaseNotesForDialog(releaseNotes: string) {
  const plainText = releaseNotes
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim()
  if (!plainText) return "此版本包含新的功能与问题修复。"
  return plainText.length <= 1200 ? plainText : `${plainText.slice(0, 1199)}…`
}

/** Coordinates scheduled/manual checks and the verified DMG download experience. */
export function createDesktopUpdateController(
  options: DesktopUpdateControllerOptions,
): DesktopUpdateController {
  const fetchImpl = options.fetchImpl || fetch
  const now = options.now || Date.now
  const reportError =
    options.reportError || ((message: string, error: unknown) => console.error(message, error))
  let status: "available" | "checking" | "downloading" | "idle" = "idle"
  let availableRelease: DesktopUpdateRelease | null = null
  let activeOperation: AbortController | undefined
  let checkTask: Promise<void> | undefined
  let initialTimer: ReturnType<typeof setTimeout> | undefined
  let intervalTimer: ReturnType<typeof setInterval> | undefined

  const notifyStateChange = () => options.onStateChange?.()
  const setStatus = (nextStatus: typeof status) => {
    status = nextStatus
    notifyStateChange()
  }

  const promptForUpdate = async (release: DesktopUpdateRelease, signal: AbortSignal) => {
    const result = await options.showMessageBox({
      buttons: ["下载更新", "稍后", "忽略此版本"],
      cancelId: 1,
      defaultId: 0,
      detail: `${releaseNotesForDialog(release.releaseNotes)}\n\n下载完成并通过 SHA-256 校验后，Codex Skin 会自动打开 DMG。`,
      message: `发现 Codex Skin ${release.displayVersion}`,
      title: "Codex Skin 更新",
      type: "info",
    })

    if (result.response === 2) {
      const state = await readUpdateState(options.dataDirectory)
      await writeUpdateState(options.dataDirectory, { ...state, ignoredTag: release.tag })
      return
    }
    if (result.response !== 0) return

    setStatus("downloading")
    options.setProgress?.(2)
    try {
      const downloadedPath = await downloadDesktopUpdate(release, {
        downloadsDirectory: options.downloadsDirectory,
        fetchImpl,
        onProgress: (receivedBytes, totalBytes) => {
          options.setProgress?.(totalBytes ? receivedBytes / totalBytes : 2)
        },
        signal,
      })
      const openError = await options.openPath(downloadedPath)
      if (openError) throw new Error(openError)
      await options.showMessageBox({
        buttons: ["好"],
        detail:
          "安装包已经打开。请将 Codex Skin 拖入“应用程序”文件夹并选择替换；当前应用不会自行修改或覆盖已安装程序。",
        message: "更新已下载并通过安全校验",
        title: "Codex Skin 更新",
        type: "info",
      })
    } catch (error) {
      if (signal.aborted) return
      reportError("Unable to download the Codex Skin update:", error)
      await options.showMessageBox({
        buttons: ["好"],
        detail: error instanceof Error ? error.message : String(error),
        message: "更新下载失败",
        title: "Codex Skin 更新",
        type: "error",
      })
    } finally {
      options.setProgress?.(-1)
      setStatus("available")
    }
  }

  const runCheck = async (manual: boolean, signal: AbortSignal) => {
    if (!parseDesktopReleaseTag(options.currentTag)) {
      if (manual) {
        await options.showMessageBox({
          buttons: ["好"],
          detail: "只有通过 GitHub Release 构建的客户端才包含可比较的发布版本信息。",
          message: "当前开发构建无法检查更新",
          title: "Codex Skin 更新",
          type: "info",
        })
      }
      return
    }

    if (manual && availableRelease) {
      await promptForUpdate(availableRelease, signal)
      return
    }

    const previousState = await readUpdateState(options.dataDirectory)
    if (
      !manual &&
      previousState.lastCheckedAtMs !== null &&
      now() - previousState.lastCheckedAtMs < AUTOMATIC_CHECK_INTERVAL_MS
    ) {
      return
    }

    setStatus("checking")
    try {
      const release = await fetchDesktopUpdate(options.currentTag, fetchImpl, signal)
      availableRelease = release
      await writeUpdateState(options.dataDirectory, {
        ...previousState,
        lastCheckedAtMs: now(),
      })

      if (!release) {
        setStatus("idle")
        if (manual) {
          await options.showMessageBox({
            buttons: ["好"],
            detail: `当前版本：${formatDesktopVersion(options.currentTag)}`,
            message: "当前已经是最新版本",
            title: "Codex Skin 更新",
            type: "info",
          })
        }
        return
      }

      setStatus("available")
      if (!manual && previousState.ignoredTag === release.tag) return
      await promptForUpdate(release, signal)
    } catch (error) {
      setStatus("idle")
      if (signal.aborted) return
      reportError("Unable to check for Codex Skin updates:", error)
      if (manual) {
        await options.showMessageBox({
          buttons: ["好"],
          detail: error instanceof Error ? error.message : String(error),
          message: "暂时无法检查更新",
          title: "Codex Skin 更新",
          type: "warning",
        })
      }
    }
  }

  const checkForUpdates = async (manual: boolean) => {
    if (checkTask) return await checkTask
    if (status === "downloading") return
    activeOperation = new AbortController()
    checkTask = runCheck(manual, activeOperation.signal).finally(() => {
      activeOperation = undefined
      checkTask = undefined
    })
    return await checkTask
  }

  return {
    checkForUpdates: async ({ manual = false } = {}) => await checkForUpdates(manual),
    destroy: async () => {
      if (initialTimer) clearTimeout(initialTimer)
      if (intervalTimer) clearInterval(intervalTimer)
      initialTimer = undefined
      intervalTimer = undefined
      activeOperation?.abort()
      await checkTask
    },
    getMenuItemState: () => {
      if (status === "checking") return { enabled: false, label: "正在检查更新…" }
      if (status === "downloading") return { enabled: false, label: "正在下载更新…" }
      if (status === "available" && availableRelease) {
        return { enabled: true, label: `下载 ${availableRelease.displayVersion}…` }
      }
      return { enabled: true, label: "检查更新…" }
    },
    startAutomaticChecks: () => {
      if (!parseDesktopReleaseTag(options.currentTag) || initialTimer || intervalTimer) return
      const initialDelay = options.initialCheckDelayMs ?? AUTOMATIC_CHECK_INITIAL_DELAY_MS
      initialTimer = setTimeout(() => void checkForUpdates(false), initialDelay)
      initialTimer.unref?.()
      intervalTimer = setInterval(() => void checkForUpdates(false), AUTOMATIC_CHECK_INTERVAL_MS)
      intervalTimer.unref?.()
    },
  }
}
