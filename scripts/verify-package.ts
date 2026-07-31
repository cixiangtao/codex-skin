import { access, readFile } from "node:fs/promises"

interface PackageManifest {
  bin?: Record<string, string>
  bugs?: {
    url?: string
  }
  engines?: Record<string, string>
  files?: string[]
  homepage?: string
  license?: string
  repository?: {
    url?: string
  }
}

const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest
const entryPath = manifest.bin?.["codex-skin"]

if (entryPath !== "dist/bin/codex-skin.js") {
  throw new Error("The npm binary must point to the compiled JavaScript entry.")
}
if (!manifest.engines?.node || manifest.engines.bun) {
  throw new Error("The published runtime must require Node.js without requiring Bun.")
}
if (manifest.files?.length !== 1 || manifest.files[0] !== "dist") {
  throw new Error("The npm package must publish compiled dist files only.")
}
if (manifest.license !== "MIT") {
  throw new Error("The npm package must declare the repository MIT license.")
}
if (manifest.homepage !== "https://cixiangtao.github.io/codex-skin/") {
  throw new Error("The npm package homepage must point to the project site.")
}
if (manifest.repository?.url !== "git+https://github.com/cixiangtao/codex-skin.git") {
  throw new Error("The npm package repository URL is inconsistent.")
}
if (manifest.bugs?.url !== "https://github.com/cixiangtao/codex-skin/issues") {
  throw new Error("The npm package issue URL is inconsistent.")
}

const npmReadme = await readFile("README.md", "utf8")
if (!npmReadme.includes("https://github.com/cixiangtao/codex-skin#readme")) {
  throw new Error("The npm README must link to the canonical GitHub documentation.")
}
if (/releases\/download\/desktop-v/.test(npmReadme)) {
  throw new Error("The npm README must not contain version-specific desktop downloads.")
}

const entry = await readFile(entryPath, "utf8")
if (!entry.startsWith("#!/usr/bin/env node\n")) {
  throw new Error("The compiled npm binary must use the Node.js shebang.")
}
if (entry.includes("#!/usr/bin/env bun") || /\bBun\s*\./.test(entry)) {
  throw new Error("The compiled npm binary still contains a Bun runtime dependency.")
}

await access("dist/ui/index.html")
console.log("Verified the Node.js CLI and packaged settings UI.")
