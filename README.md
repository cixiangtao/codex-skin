# Codex Background

A local companion that places transparent character art inside the Codex desktop workspace without modifying or re-signing `ChatGPT.app`.

## Run

Requirements:

- macOS
- Node.js 22 or newer, including npm and `npx`
- Codex/ChatGPT desktop app in `/Applications/ChatGPT.app`

Once published, the complete user flow is one command:

```bash
npx @anys/codex-background
```

The command opens the light visual settings page, starts Codex with a loopback-only Chrome DevTools Protocol port, injects the configured character layer, and keeps new windows synchronized. The background daemon exits when Codex exits.

If no character image has been configured yet, the settings page opens first. Choose an image and select **启动背景模式**.

## Visual settings

The local settings page supports:

- PNG, JPEG, WebP, GIF, and AVIF images up to 25 MB
- preserved PNG/WebP alpha transparency
- direct drag positioning and X/Y sliders
- character size, opacity, and edge blur
- immediate application to connected Codex windows

Settings and uploaded images remain in `~/.config/codex-background/`. The settings server binds only to `127.0.0.1`, uses a random session token, and shuts down after 30 minutes without a request.

## Commands

```bash
npx @anys/codex-background                # open settings and start background mode
npx @anys/codex-background settings       # open settings only
npx @anys/codex-background doctor         # inspect the local runtime
npx @anys/codex-background show           # print normalized configuration
npx @anys/codex-background stop           # remove the injected layer
npx @anys/codex-background disable        # stop and persist the disabled state
```

Terminal-based appearance changes remain available for automation:

```bash
npx @anys/codex-background configure \
  --image "/absolute/path/to/character.png" \
  --illustration-size 360 \
  --x 82 \
  --y 76 \
  --opacity 0.72 \
  --blur 0
```

## Important lifecycle detail

The CDP flag must be present when Codex starts. If Codex is already running in normal mode, the tool will ask you to quit it normally instead of killing or silently relaunching it. Start subsequent sessions with the `npx` command so the background connection is available from launch.

The helper never changes `app.asar`, `ElectronAsarIntegrity`, the app signature, login data, or the updater. CDP has no application-level authentication, so it remains bound to loopback and should not be exposed to the network.

## Development

```bash
bun install
bun dev          # start the Vite UI and local API together
bun dev:ui       # start only the Vite UI on 127.0.0.1:4178
bun dev:server   # start only the settings API on 127.0.0.1:4179
bun run test
bun run check
bun run build
```

`bun dev` authenticates the local development session, opens the Vite page, and stops both child processes together when you press `Ctrl+C`. Development uses Bun and TypeScript, but the npm package publishes a compiled Node.js executable. End users do not need Bun or TypeScript. The settings UI uses Tailwind CSS 4, Vite+, Vite, and Vitest.

## Release

Run an optional standalone preflight without changing the version or publishing:

```bash
bun run release:check
```

Start the interactive release when ready:

```bash
bun run release
```

The release command runs the same preflight automatically, then updates the version, creates the release commit and tag, pushes them, and publishes the compiled package to npm.
