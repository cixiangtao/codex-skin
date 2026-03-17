import { access, readFile } from "node:fs/promises"

interface PackageManifest {
  bin?: Record<string, string>
  engines?: Record<string, string>
  files?: string[]
}

const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageManifest
const entryPath = manifest.bin?.["codex-background"]

if (entryPath !== "./dist/bin/codex-background.js") {
  throw new Error("The npm binary must point to the compiled JavaScript entry.")
}
if (!manifest.engines?.node || manifest.engines.bun) {
  throw new Error("The published runtime must require Node.js without requiring Bun.")
}
if (manifest.files?.length !== 1 || manifest.files[0] !== "dist") {
  throw new Error("The npm package must publish compiled dist files only.")
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
