# Codex Background plugin

This directory is the installable Codex plugin. It contains the visual settings page, background CLI, lifecycle hook, plugin skill, and presentation assets.

The plugin does not patch or re-sign `ChatGPT.app`. The first `start` launches the existing signed app with Chrome DevTools Protocol bound to `127.0.0.1`, injects a style element, and keeps new Codex windows synchronized through a small Node.js daemon.

Use the repository-level [README](../../README.md) for setup and recovery instructions.

Open the visual darkroom with:

```bash
CODEX_BACKGROUND_HOME="$HOME/.config/codex-background" node ./bin/codex-background.mjs settings
```
