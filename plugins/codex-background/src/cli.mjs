const OPTION_NAMES = new Map([
  ["--image", "image"],
  ["--illustration-size", "illustrationSize"],
  ["--x", "illustrationX"],
  ["--y", "illustrationY"],
  ["--blur", "illustrationBlur"],
  ["--opacity", "illustrationOpacity"],
  ["--port", "port"],
  ["--app-path", "appPath"],
  ["--enable", "enabled"],
  ["--disable", "disabled"],
]);
const BOOLEAN_OPTIONS = new Set(["--enable", "--disable"]);

import { access } from "node:fs/promises";
import path from "node:path";

import {
  injectConfiguredBackground,
  startConfiguredBackground,
} from "./background-service.mjs";
import { isCdpAvailable } from "./cdp.mjs";
import { readConfig, resolveConfigPath, writeConfig } from "./config.mjs";
import { imageFileToDataUrl } from "./css.mjs";
import { readDaemonPid, runDaemon, stopDaemon } from "./daemon.mjs";
import { removeFromAllTargets } from "./injector.mjs";
import {
  appExecutableExists,
  resolveAppExecutable,
} from "./macos.mjs";
import {
  ensureSettingsServer,
  openSettingsPage,
  runSettingsServerDaemon,
} from "./settings-server.mjs";

const HELP = `Codex Background

Usage:
  codex-background configure --image /absolute/wallpaper.webp [options]
  codex-background settings
  codex-background show
  codex-background doctor
  codex-background start
  codex-background inject
  codex-background stop
  codex-background enable
  codex-background disable

Options:
  settings                     Open the local visual settings page
  --image PATH                 PNG, JPEG, WebP, GIF, or AVIF up to 25 MB
  --illustration-size 80..1200 Illustration width in pixels
  --x 0..100                   Horizontal illustration position
  --y 0..100                   Vertical illustration position
  --blur 0..30                 Illustration-only blur in pixels
  --opacity 0..1               Illustration-only opacity
  --port 1024..65535           Loopback CDP port (default 9229)
  --app-path PATH              ChatGPT.app location
`;

export function parseArguments(argv) {
  const [command = "help", ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const name = OPTION_NAMES.get(token);
    if (!name) throw new Error(`Unknown option: ${token}`);
    if (BOOLEAN_OPTIONS.has(token)) {
      options[name] = true;
      continue;
    }
    const value = tokens[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    options[name] = value;
    index += 1;
  }
  return { command, options };
}

function printableConfig(config) {
  return `${JSON.stringify(config, null, 2)}\nConfig: ${resolveConfigPath()}`;
}

async function configure(options, io) {
  const current = await readConfig();
  const updates = { ...options };
  if (updates.disabled) {
    updates.enabled = false;
    delete updates.disabled;
  }
  if (updates.image) {
    updates.image = path.resolve(updates.image);
    await imageFileToDataUrl(updates.image);
  }
  const config = await writeConfig({ ...current, ...updates });
  io.log(printableConfig(config));
}

async function start(entryPath, io) {
  const config = await readConfig();
  const result = await startConfiguredBackground(config, { entryPath });
  io.log(
    `Injected ${result.targets} Codex window${result.targets === 1 ? "" : "s"}. Background daemon PID: ${result.daemon.pid}.`,
  );
}

async function doctor(io) {
  const config = await readConfig();
  const checks = [
    ["Node.js 22+", Number(process.versions.node.split(".")[0]) >= 22],
    ["ChatGPT executable", await appExecutableExists(config.appPath)],
    ["Background image configured", Boolean(config.image)],
    [
      "Background image readable",
      config.image
        ? await access(config.image)
            .then(() => true)
            .catch(() => false)
        : false,
    ],
    [`CDP 127.0.0.1:${config.port}`, await isCdpAvailable({ port: config.port })],
    ["Background daemon", Boolean(await readDaemonPid())],
  ];
  for (const [label, passed] of checks) io.log(`${passed ? "✓" : "·"} ${label}`);
  io.log(`Config: ${resolveConfigPath()}`);
  return checks.slice(0, 4).every(([, passed]) => passed) ? 0 : 1;
}

export async function runCli(argv, options = {}) {
  const io = options.io || console;
  const entryPath = options.entryPath || process.argv[1];
  const { command, options: commandOptions } = parseArguments(argv);
  switch (command) {
    case "help":
    case "--help":
    case "-h":
      io.log(HELP);
      return 0;
    case "configure":
      await configure(commandOptions, io);
      return 0;
    case "settings": {
      const server = await ensureSettingsServer({ entryPath });
      openSettingsPage(server.url);
      io.log(`Opened Codex Background settings at http://127.0.0.1:${server.port}/`);
      return 0;
    }
    case "show":
      io.log(printableConfig(await readConfig()));
      return 0;
    case "doctor":
      return await doctor(io);
    case "start":
      await start(entryPath, io);
      return 0;
    case "inject": {
      const config = await readConfig();
      if (!(await isCdpAvailable({ port: config.port }))) {
        throw new Error(`CDP is not available on 127.0.0.1:${config.port}.`);
      }
      io.log(`Injected ${await injectConfiguredBackground(config)} Codex window(s).`);
      return 0;
    }
    case "stop": {
      const config = await readConfig();
      const pid = await stopDaemon();
      if (await isCdpAvailable({ port: config.port })) {
        await removeFromAllTargets({ port: config.port });
      }
      io.log(pid ? `Stopped background daemon ${pid}.` : "Background daemon was not running.");
      return 0;
    }
    case "enable": {
      const config = await readConfig();
      await writeConfig({ ...config, enabled: true });
      io.log("Codex Background enabled. Run `codex-background start` to apply it.");
      return 0;
    }
    case "disable": {
      const config = await readConfig();
      await writeConfig({ ...config, enabled: false });
      await stopDaemon();
      if (await isCdpAvailable({ port: config.port })) {
        await removeFromAllTargets({ port: config.port });
      }
      io.log("Codex Background disabled. Codex itself was left running.");
      return 0;
    }
    case "daemon":
      await runDaemon();
      return 0;
    case "settings-server":
      await runSettingsServerDaemon({ entryPath });
      return 0;
    default:
      throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }
}
