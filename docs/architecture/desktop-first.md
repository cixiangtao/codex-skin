# Desktop-first architecture decision

English | [简体中文](desktop-first.zh-CN.md)

Status: accepted
Date: 2026-07-27

## Decision

The macOS desktop client is the formal Codex Skin product entry point. Ordinary users install, configure, and run themes through the client without installing Node.js or Bun or using a terminal.

The CLI remains available, but only for:

- automated tests and continuous integration;
- Core and startup-flow development;
- diagnostics and recovery in headless environments;
- fallback recovery when the client cannot start or its state is unhealthy.

## Architecture boundary

- Core is the single implementation of configuration, launch, injection, synchronization, verification, and state decisions.
- Electron and the CLI are host adapters and must not duplicate Core business logic.
- New behavior enters Core before an entry point consumes it.
- The CLI stays compact and backward compatible; it does not receive a separate ordinary-user interaction model.
- User documentation, release notes, issue guidance, and installation flows default to the desktop client.

## Delivery boundary

- Desktop artifacts are the main ordinary-user distribution.
- The npm CLI is a separately releasable development and support tool, not the default installation recommendation.
- A client without signing, notarization, or the target architecture build must be labeled as a development preview, not a completed public release.

## Reconsideration

Deprecate the CLI only after automation, development, headless diagnostics, and client fallback each have an equivalent replacement and there is no demonstrated CLI usage requirement.
