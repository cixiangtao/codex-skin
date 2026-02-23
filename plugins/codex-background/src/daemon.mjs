import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { isCdpAvailable } from "./cdp.mjs";
import { buildBackgroundCss } from "./css.mjs";
import { readConfig, resolveDataDirectory } from "./config.mjs";
import { injectAllTargets } from "./injector.mjs";

function runtimePaths(options = {}) {
  const dataDirectory = options.dataDirectory || resolveDataDirectory(options.env);
  return {
    dataDirectory,
    pid: path.join(dataDirectory, "daemon.pid"),
    log: path.join(dataDirectory, "daemon.log"),
    state: path.join(dataDirectory, "daemon-state.json"),
  };
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function readDaemonPid(options = {}) {
  const paths = runtimePaths(options);
  try {
    const pid = Number.parseInt(await readFile(paths.pid, "utf8"), 10);
    return processIsAlive(pid) ? pid : null;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function ensureDaemon({ entryPath, spawnImpl = spawn, ...options }) {
  const existingPid = await readDaemonPid(options);
  if (existingPid) return { pid: existingPid, started: false };
  const paths = runtimePaths(options);
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 });
  const child = spawnImpl(process.execPath, [entryPath, "daemon"], {
    detached: true,
    env: process.env,
    stdio: "ignore",
  });
  child.unref();
  await writeFile(paths.pid, `${child.pid}\n`, { mode: 0o600 });
  return { pid: child.pid, started: true };
}

export async function stopDaemon(options = {}) {
  const paths = runtimePaths(options);
  const pid = await readDaemonPid(options);
  if (pid) process.kill(pid, "SIGTERM");
  await rm(paths.pid, { force: true });
  return pid;
}

export async function runDaemon(options = {}) {
  const paths = runtimePaths(options);
  await mkdir(paths.dataDirectory, { recursive: true, mode: 0o700 });
  await writeFile(paths.pid, `${process.pid}\n`, { mode: 0o600 });
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  let cachedConfig = null;
  let cachedCss = null;

  try {
    while (!stopping) {
      let pollIntervalMs = 3000;
      try {
        const config = await readConfig(options);
        pollIntervalMs = config.pollIntervalMs;
        if (config.enabled && config.image && (await isCdpAvailable({ port: config.port }))) {
          const signature = JSON.stringify(config);
          if (signature !== cachedConfig) {
            cachedCss = await buildBackgroundCss(config);
            cachedConfig = signature;
          }
          const results = await injectAllTargets({ css: cachedCss, port: config.port });
          await writeFile(
            paths.state,
            `${JSON.stringify(
              {
                pid: process.pid,
                updatedAt: new Date().toISOString(),
                injectedTargets: results.filter((result) => result.ok).length,
                failedTargets: results.filter((result) => !result.ok).length,
              },
              null,
              2,
            )}\n`,
            { mode: 0o600 },
          );
        }
      } catch (error) {
        await appendFile(paths.log, `${new Date().toISOString()} ${error.stack || error.message}\n`, {
          mode: 0o600,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  } finally {
    const currentPid = await readFile(paths.pid, "utf8").catch(() => "");
    if (Number.parseInt(currentPid, 10) === process.pid) await rm(paths.pid, { force: true });
  }
}
