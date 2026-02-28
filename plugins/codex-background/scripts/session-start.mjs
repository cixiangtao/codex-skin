import path from "node:path";
import { fileURLToPath } from "node:url";

import { isCdpAvailable } from "../src/cdp.mjs";
import { readConfig } from "../src/config.mjs";
import { ensureDaemon } from "../src/daemon.mjs";

const pluginRoot = process.env.PLUGIN_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entryPath = path.join(pluginRoot, "bin", "codex-background.mjs");

try {
  const config = await readConfig();
  if (config.enabled && config.image && (await isCdpAvailable({ port: config.port }))) {
    await ensureDaemon({ entryPath });
  }
} catch {
  // A lifecycle hook must never block a Codex thread because optional styling is unavailable.
}
