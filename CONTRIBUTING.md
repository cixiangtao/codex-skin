# Contributing to Codex Skin

English | [简体中文](CONTRIBUTING.zh-CN.md)

Codex Skin is desktop-first. The Electron client is the user-facing product; the npm CLI is an automation, diagnostics, and recovery adapter. Shared behavior belongs in Core before either entry point calls it.

## Environment

- Apple Silicon Mac for current desktop-client validation
- Node.js 22+
- Bun 1.3.14
- Codex desktop app installed

```bash
bun install --frozen-lockfile
bun run desktop
bun run test
bun run check
bun run ci
```

Run checks proportional to the change. Shared Core, CLI, desktop packaging, project-site, and release-configuration changes should normally pass `bun run ci`.

## Pull requests

1. Branch from `main` and keep each change focused.
2. Use Conventional Commits, such as `fix(runtime): ...` or `docs(readme): ...`.
3. Explain the user impact, verification, and affected delivery channels.
4. Do not commit tokens, authentication links, user images, local configuration, private logs, or build output.

Only maintainers create release tags, GitHub Releases, or npm versions. See the [release process](docs/release-process.md). Report vulnerabilities privately through [Security](SECURITY.md).
