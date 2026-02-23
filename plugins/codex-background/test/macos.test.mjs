import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLaunchArguments,
  processListContainsExecutable,
  resolveAppExecutable,
} from "../src/macos.mjs";

test("resolveAppExecutable targets the signed app executable", () => {
  assert.equal(
    resolveAppExecutable("/Applications/ChatGPT.app"),
    "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT",
  );
});

test("buildLaunchArguments binds CDP to loopback", () => {
  assert.deepEqual(buildLaunchArguments(9229), [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9229",
  ]);
});

test("processListContainsExecutable matches the GUI process without matching helpers", () => {
  const executable = "/Applications/ChatGPT.app/Contents/MacOS/ChatGPT";
  const processList = [
    "/Applications/ChatGPT.app/Contents/Resources/codex app-server",
    executable,
    "/bin/zsh -lc something else",
  ].join("\n");

  assert.equal(processListContainsExecutable(processList, executable), true);
  assert.equal(processListContainsExecutable(processList, "/Applications/Other.app/Other"), false);
});
