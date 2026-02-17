import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function collectJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectJavaScript(entryPath)));
    else if (entry.name.endsWith(".mjs")) files.push(entryPath);
  }
  return files;
}

for (const jsonPath of [
  "package.json",
  ".codex-plugin/plugin.json",
  "hooks/hooks.json",
]) {
  JSON.parse(await readFile(path.join(pluginRoot, jsonPath), "utf8"));
}

const files = (
  await Promise.all(["bin", "src", "scripts", "test"].map((directory) => collectJavaScript(path.join(pluginRoot, directory))))
).flat();
files.push(path.join(pluginRoot, "ui", "app.js"));
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

const tests = spawnSync(process.execPath, ["--test", "--test-reporter=spec"], {
  cwd: pluginRoot,
  stdio: "inherit",
});
process.exit(tests.status || 0);
