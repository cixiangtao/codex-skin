import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

export function resolveAppExecutable(appPath) {
  return path.join(path.resolve(appPath), "Contents", "MacOS", "ChatGPT");
}

export function buildLaunchArguments(port) {
  return ["--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`];
}

export async function appExecutableExists(appPath) {
  try {
    await access(resolveAppExecutable(appPath));
    return true;
  } catch {
    return false;
  }
}

export async function isCodexRunning(appPath) {
  const executable = resolveAppExecutable(appPath);
  const { stdout } = await execFileAsync("ps", ["-ax", "-o", "command="]);
  return processListContainsExecutable(stdout, executable);
}

export function processListContainsExecutable(processList, executable) {
  return String(processList)
    .split("\n")
    .some((command) => command === executable || command.startsWith(`${executable} `));
}

export function launchCodex({ appPath, port, spawnImpl = spawn }) {
  const child = spawnImpl(resolveAppExecutable(appPath), buildLaunchArguments(port), {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}
