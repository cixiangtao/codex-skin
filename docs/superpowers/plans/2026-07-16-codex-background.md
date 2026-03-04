# Codex Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a local Codex plugin plus a macOS sidecar that launches Codex with a loopback-only Chrome DevTools endpoint and injects a configurable image background without modifying `app.asar`.

**Architecture:** The plugin packages a dependency-free Node.js CLI, configuration store, CSS generator, CDP client, and a trusted `SessionStart` hook. The CLI owns launching and monitoring Codex; the plugin hook only reconnects the injector when a thread starts, so it never edits or re-signs the application bundle.

**Tech Stack:** Node.js 22+ ESM, built-in `fetch` and `WebSocket`, Node test runner, Codex plugin manifest and lifecycle hooks, macOS Electron/Chrome DevTools Protocol.

---

### Task 1: Standard plugin and marketplace structure

**Files:**
- Create: `.agents/plugins/marketplace.json`
- Create: `plugins/codex-background/.codex-plugin/plugin.json`
- Create: `plugins/codex-background/assets/icon.svg`
- Create: `plugins/codex-background/assets/logo.svg`

- [x] **Step 1: Scaffold the plugin**

Run:

```bash
python3 /Users/xbb/.codex/skills/.system/plugin-creator/scripts/create_basic_plugin.py codex-background \
  --path /Users/xbb/Desktop/@anys/codex-background/plugins \
  --marketplace-path /Users/xbb/Desktop/@anys/codex-background/.agents/plugins/marketplace.json \
  --marketplace-name codex-background-local \
  --with-skills --with-hooks --with-scripts --with-assets --with-marketplace
```

Expected: a normalized `codex-background` plugin and repo-local marketplace entry are created.

- [x] **Step 2: Replace scaffold metadata with the actual contract**

The manifest must identify the plugin as `codex-background`, keep strict semver, point `skills` to `./skills/`, and include only asset paths that exist. Keep `hooks` out of the manifest because Codex discovers `hooks/hooks.json` by convention.

- [x] **Step 3: Validate the scaffold**

Run:

```bash
python3 /Users/xbb/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py \
  /Users/xbb/Desktop/@anys/codex-background/plugins/codex-background
```

Expected: plugin validation succeeds with no placeholder warning.

### Task 2: Configuration and CSS generation

**Files:**
- Create: `plugins/codex-background/src/config.mjs`
- Create: `plugins/codex-background/src/css.mjs`
- Test: `plugins/codex-background/test/config.test.mjs`
- Test: `plugins/codex-background/test/css.test.mjs`

- [x] **Step 1: Write failing configuration tests**

Cover default values, numeric clamping, image existence, supported image MIME types, JSON persistence, and `PLUGIN_DATA` overriding the default data directory.

- [x] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --test test/config.test.mjs test/css.test.mjs
```

Expected: imports fail because the modules do not exist yet.

- [x] **Step 3: Implement configuration and CSS generation**

Expose these stable interfaces:

```js
export function resolveDataDirectory(env = process.env) {}
export function normalizeConfig(input, options = {}) {}
export async function readConfig(options = {}) {}
export async function writeConfig(config, options = {}) {}
export async function buildBackgroundCss(config) {}
export async function imageFileToDataUrl(imagePath) {}
```

The generated CSS must use a fixed pseudo-element, a data URL, a readable color overlay, and translucent Codex surfaces. It must never interpolate an unescaped local path into CSS.

- [x] **Step 4: Run tests**

Run `node --test test/config.test.mjs test/css.test.mjs` and expect all tests to pass.

### Task 3: CDP transport and injection lifecycle

**Files:**
- Create: `plugins/codex-background/src/cdp.mjs`
- Create: `plugins/codex-background/src/injector.mjs`
- Test: `plugins/codex-background/test/cdp.test.mjs`
- Test: `plugins/codex-background/test/injector.test.mjs`

- [x] **Step 1: Write failing CDP tests**

Use a local HTTP server and a fake WebSocket implementation to verify target discovery, request IDs, error propagation, and expression generation without connecting to the running Codex app.

- [x] **Step 2: Implement the CDP client**

Expose:

```js
export async function listPageTargets({ host, port, fetchImpl }) {}
export class CdpConnection {
  constructor(url, options = {}) {}
  async connect() {}
  async call(method, params = {}) {}
  close() {}
}
```

- [x] **Step 3: Implement idempotent injection**

`buildInjectionExpression(css)` must create or replace one `<style id="codex-background-style">`, attach an observer that restores it after host rerenders, and return a small serializable status object.

- [x] **Step 4: Run tests**

Run `node --test test/cdp.test.mjs test/injector.test.mjs` and expect all tests to pass.

### Task 4: CLI, macOS launcher, and plugin hook

**Files:**
- Create: `plugins/codex-background/bin/codex-background.mjs`
- Create: `plugins/codex-background/src/cli.mjs`
- Create: `plugins/codex-background/src/macos.mjs`
- Create: `plugins/codex-background/src/daemon.mjs`
- Create: `plugins/codex-background/hooks/hooks.json`
- Create: `plugins/codex-background/scripts/session-start.mjs`
- Create: `plugins/codex-background/package.json`
- Test: `plugins/codex-background/test/cli.test.mjs`
- Test: `plugins/codex-background/test/macos.test.mjs`

- [x] **Step 1: Write failing command and launch tests**

Cover `configure`, `show`, `doctor`, `start`, `inject`, and `stop`; verify shell-free argument construction for `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT` and loopback-only `--remote-debugging-address=127.0.0.1`.

- [x] **Step 2: Implement CLI commands**

The CLI must support:

```text
codex-background configure --image /absolute/image.webp
codex-background show
codex-background doctor
codex-background start
codex-background inject
codex-background stop
```

`start` must refuse to kill a running Codex process. If Codex is already running without the configured CDP port, print a clear quit-and-relaunch instruction.

- [x] **Step 3: Implement the SessionStart hook**

The hook command is:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "startup|resume",
      "hooks": [{
        "type": "command",
        "command": "node \"$PLUGIN_ROOT/scripts/session-start.mjs\"",
        "timeout": 5,
        "statusMessage": "Checking Codex background"
      }]
    }]
  }
}
```

It should exit successfully when no image is configured or CDP is unavailable, and it should never restart Codex from inside an active thread.

- [x] **Step 4: Run focused tests**

Run `node --test test/cli.test.mjs test/macos.test.mjs` and expect all tests to pass.

### Task 5: Documentation and destination verification

**Files:**
- Create: `README.md`
- Create: `plugins/codex-background/README.md`
- Create: `.gitignore`

- [x] **Step 1: Document installation and recovery**

Document the exact marketplace add command, plugin install command, hook trust requirement, first-run configuration command, the need to quit Codex before the first `start`, and the commands for disabling the injector without touching ChatGPT.app.

- [x] **Step 2: Run the complete project checks**

Run:

```bash
cd /Users/xbb/Desktop/@anys/codex-background/plugins/codex-background
npm test
npm run check
python3 /Users/xbb/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```

Expected: all tests pass, syntax checks pass, and plugin validation succeeds.

- [x] **Step 3: Verify the project from its permanent destination**

Run `git status --short`, inspect the final file tree, and confirm no source code was left in the temporary Codex task directory.
