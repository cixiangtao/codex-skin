# Codex Background

A local Codex plugin and macOS sidecar that adds a positionable character illustration to the Codex workspace without replacing the native background or modifying the signed application bundle.

## How it works

1. The CLI stores settings in `~/.config/codex-background/config.json`.
2. `start` launches `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT` with Chrome DevTools Protocol bound to `127.0.0.1`.
3. The helper embeds the selected illustration as a data URL and adds it only to the main workspace background. Native colors, sidebar styling, and surface effects remain untouched.
4. A detached Node.js daemon refreshes newly created windows.
5. The plugin `SessionStart` hook reconnects that daemon when an enabled background already has CDP available.

The helper never modifies `app.asar`, the app signature, login data, or the updater.

## Requirements

- macOS
- Codex/ChatGPT desktop app at `/Applications/ChatGPT.app`
- Node.js 22 or newer
- A PNG, JPEG, WebP, GIF, or AVIF image no larger than 25 MB

## Try it from the checkout

The easiest way to configure the background is the visual darkroom:

```bash
cd /Users/xbb/Desktop/@anys/codex-background/plugins/codex-background

CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" \
  node ./bin/codex-background.mjs settings
```

The command opens a loopback-only character staging page and exits. The page stays available in a small detached local process, so it can remain open while you quit Codex and relaunch it in background mode. Upload or drag in an illustration, drag the character directly in the preview, tune its size and X/Y position, then save and apply.

Transparent PNG or WebP character art works best. Alpha data is preserved byte-for-byte, while illustration-only opacity and blur can blend the character into the workspace without fading or blurring the Codex interface. JPEG images remain supported but keep their rectangular background.

The CLI remains available for scripting:

```bash
cd /Users/xbb/Desktop/@anys/codex-background/plugins/codex-background

CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" \
  node ./bin/codex-background.mjs configure \
  --image "/absolute/path/to/wallpaper.webp"

CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" \
  node ./bin/codex-background.mjs doctor
```

The first time, quit Codex normally before running:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" \
  node ./bin/codex-background.mjs start
```

`start` intentionally refuses to kill or relaunch a running Codex process that was opened without CDP.

## Appearance controls

```bash
node ./bin/codex-background.mjs configure \
  --image "/absolute/path/to/character.png" \
  --illustration-size 360 \
  --x 82 \
  --y 76 \
  --blur 0 \
  --opacity 1
```

After changing settings while Codex is connected, run `inject` for an immediate refresh. The daemon also picks up the change on its next polling cycle.

## Install the local plugin

Register this repository's marketplace once:

```bash
codex plugin marketplace add /Users/xbb/Desktop/@anys/codex-background
codex plugin add codex-background@codex-background-local
```

Restart the Codex app, open a new task, review and trust the bundled lifecycle hook, then ask Codex to set or tune the background. The plugin hook does not launch or restart Codex from an active task; it only reconnects the sidecar when CDP is already available.

## Commands

| Command | Effect |
| --- | --- |
| `settings` | Open the local visual settings page |
| `configure --image PATH` | Save the image and appearance settings |
| `show` | Print the normalized configuration |
| `doctor` | Inspect Node, app, image, CDP, and daemon state |
| `start` | Launch Codex with loopback CDP, inject, and start the daemon |
| `inject` | Apply the latest settings to connected Codex windows |
| `stop` | Remove injected CSS and stop the daemon |
| `disable` | Stop, remove, and persist the disabled state |
| `enable` | Re-enable future starts without launching Codex |

## Recovery

The safest rollback is:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" \
  node ./bin/codex-background.mjs disable
```

This leaves Codex running and removes only the injected style. If the helper is not available, quitting and reopening Codex normally also starts it without the custom background.

CDP has no application-level authentication, so the helper binds it only to loopback. Other processes running as the same macOS user can still reach the local port; disable the background when that tradeoff is unacceptable.

## Development

```bash
cd /Users/xbb/Desktop/@anys/codex-background/plugins/codex-background
npm test
npm run check
python3 /Users/xbb/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py .
```
