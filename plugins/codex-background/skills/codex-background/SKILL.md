---
name: codex-background
description: Configure, place, resize, fade, blur, start, inspect, stop, or disable transparent local character art in the Codex workspace background using the bundled sidecar. Use when the user asks to add character art, an illustration, or a small decorative background to Codex.
---

# Codex Background

Use the bundled CLI instead of editing `ChatGPT.app` or `app.asar`.

Resolve the plugin root from this skill directory by moving two directories up. Run the CLI with a stable shared data directory:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" node <plugin-root>/bin/codex-background.mjs <command>
```

## Open visual settings

Prefer the local settings page for interactive changes. When the user asks to open background settings, run:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" node <plugin-root>/bin/codex-background.mjs settings
```

The command opens a loopback-only character staging UI and returns immediately. The page preserves transparent PNG/WebP data and supports upload and drag-and-drop, direct character dragging, illustration size, X/Y position, illustration-only opacity and blur, enable/disable, immediate apply, and safe first launch. It never kills Codex automatically.

## Set a background

Use the visual settings page unless the user explicitly prefers the CLI or the workflow is automated.

1. Confirm the image is a local PNG, JPEG, WebP, GIF, or AVIF no larger than 25 MB.
2. Configure it with an absolute path:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" node <plugin-root>/bin/codex-background.mjs configure --image "/absolute/path/wallpaper.webp"
```

3. Run `doctor`.
4. If Codex is already running without CDP, explain that the user must quit Codex normally. Never kill Codex automatically.
5. After Codex is closed, run `start`. It launches the signed app with a loopback-only CDP port, injects the background, and starts the sidecar.

## Tune character placement

Apply only values the user requested. Useful controls:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" node <plugin-root>/bin/codex-background.mjs configure \
  --illustration-size 360 \
  --x 82 \
  --y 76 \
  --blur 0 \
  --opacity 1
```

Run `inject` afterward when Codex is already connected through CDP.

## Recover safely

- `stop` removes the injected CSS and stops the sidecar without quitting Codex.
- `disable` also persists the disabled state so the SessionStart hook does not restart the sidecar.
- `show` prints the active configuration.
- `doctor` reports the app, image, CDP, and daemon state.

Do not alter the app bundle, update `ElectronAsarIntegrity`, re-sign the app, expose CDP beyond `127.0.0.1`, or kill a running Codex process.
