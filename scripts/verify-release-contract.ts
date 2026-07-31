import { readFile } from "node:fs/promises"

interface PackageManifest {
  version?: string
}

interface ReleaseConfig {
  desktop?: {
    preview?: number
    version?: string
  }
}

const repositoryUrl = "https://github.com/cixiangtao/codex-skin"
const packageManifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest
const releaseConfig = JSON.parse(await readFile("config/release.json", "utf8")) as ReleaseConfig

const packageVersion = packageManifest.version
const desktopVersion = releaseConfig.desktop?.version
const desktopPreview = releaseConfig.desktop?.preview

if (!packageVersion || !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error("package.json must contain a stable SemVer version.")
}
if (!desktopVersion || !/^\d+\.\d+\.\d+$/.test(desktopVersion)) {
  throw new Error("config/release.json must contain a stable desktop SemVer version.")
}
if (!Number.isInteger(desktopPreview) || Number(desktopPreview) < 1) {
  throw new Error("config/release.json must contain a positive desktop preview number.")
}

const desktopTag = `desktop-v${desktopVersion}-preview.${desktopPreview}`
const releaseUrl = `${repositoryUrl}/releases/tag/${desktopTag}`
const downloadBase = `${repositoryUrl}/releases/download/${desktopTag}`
const expectedDocumentation = [
  releaseUrl,
  `${downloadBase}/Codex-Skin-${desktopVersion}-arm64.dmg`,
  `${downloadBase}/Codex-Skin-${desktopVersion}-arm64.zip`,
  `${downloadBase}/SHA256SUMS.txt`,
]

const githubReadme = await readFile(".github/README.md", "utf8")
for (const expected of expectedDocumentation) {
  if (!githubReadme.includes(expected)) {
    throw new Error(`.github/README.md is missing the current desktop URL: ${expected}`)
  }
}

const npmReadme = await readFile("README.md", "utf8")
if (!npmReadme.includes(`${repositoryUrl}#readme`)) {
  throw new Error("README.md must point npm users to the canonical GitHub documentation.")
}
if (/releases\/download\/desktop-v/.test(npmReadme)) {
  throw new Error("README.md must not embed version-specific desktop download URLs.")
}

const siteSource = await readFile("apps/site/main.tsx", "utf8")
if (!siteSource.includes('import releaseConfig from "../../config/release.json"')) {
  throw new Error("The project homepage must read its desktop version from config/release.json.")
}
if (/desktopPreviewVersion\s*=\s*["']/.test(siteSource)) {
  throw new Error("The project homepage must not hard-code the desktop version.")
}

const expectedTag = process.env.CODEX_SKIN_EXPECTED_DESKTOP_TAG
if (expectedTag) {
  if (packageVersion !== desktopVersion) {
    throw new Error(
      `Desktop releases require package version ${packageVersion} to match desktop version ${desktopVersion}.`,
    )
  }
  if (expectedTag !== desktopTag) {
    throw new Error(`Tag ${expectedTag} does not match release contract ${desktopTag}.`)
  }
}

console.log(`Verified desktop release contract for ${desktopTag}.`)
