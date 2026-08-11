# Codex Skin project status

English | [简体中文](MAINTENANCE.zh-CN.md)

Codex Skin entered maintenance mode on August 11, 2026.

The source code, documentation, and existing releases remain available under their current licenses. The project is no longer pursuing a parallel feature roadmap for Codex desktop themes.

## Why the project is changing direction

Codex Skin proved that a desktop-first macOS client could apply reversible, local theme layers without modifying the Codex application bundle. It delivered a shared Core and CLI, separate global, main-panel, and sidebar scenes, runtime diagnostics, recovery commands, and verified desktop update downloads.

During the same period, [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) grew into an active cross-platform project with a theme package format, desktop clients, an online Studio, a reviewed Gallery, and a contributor community. Building another overlapping ecosystem would divide maintenance effort without giving users a better result.

Future theme work from this maintainer will therefore be considered for the Codex Dream Skin community first. This is a direction for future contributions, not an announced merger, migration agreement, or support commitment by either project.

## What maintenance mode means

- Existing source, releases, and documentation remain available.
- Critical security, recovery, and narrowly scoped compatibility fixes may still be considered.
- New theme marketplaces, cross-platform ports, package protocols, and feature-parity work are out of scope here.
- Feature requests may be closed or redirected to a more active upstream or community project.
- No compatibility guarantee or response-time commitment is made for future Codex desktop releases.

## Existing users

Codex Skin does not migrate its configuration automatically to another project. Before trying a different theming runtime:

1. Quit Codex Skin from its application or menu-bar menu.
2. If you used the npm CLI, run `npx codex-skin stop` to stop its background services and remove the injected scenes.
3. Open Codex normally and confirm that the official appearance has returned.
4. Install another theming runtime only after Codex Skin has stopped. Do not run two CDP-based theming tools against the same Codex session.

Your Codex Skin configuration and uploaded images remain under `~/.config/codex-skin/` by default. They are not deleted automatically and are not currently imported by Codex Dream Skin.

For an actively developed theming ecosystem, see the [Codex Dream Skin repository](https://github.com/Fei-Away/Codex-Dream-Skin) and [DreamSkin community](https://www.dreamskin.cc/).

## What remains valuable

This repository is kept public because the implementation and its engineering decisions remain useful. The project produced a working macOS client, a shared runtime boundary, layered scene controls, local-only configuration, recovery tooling, and a checksum-verified update handoff. Maintenance mode closes the competing product roadmap; it does not erase the work.

## Candidate upstream contributions

The following Codex Skin work may be useful when a concrete need aligns with the Codex Dream Skin roadmap:

- the separate global, main-panel, and sidebar scene model in `src/runtime/config.ts`, `src/runtime/css.ts`, and the corresponding UI components;
- loopback ownership checks, runtime diagnostics, verification, and safe process cleanup under `src/runtime/`;
- the checksum-verified DMG discovery and handoff flow in `src/desktop/update.ts`;
- interaction and accessibility patterns from the visual settings client.

These are contribution candidates, not a plan to copy the repository wholesale. Any upstream work should begin with the upstream project's current architecture and maintainer guidance, then adapt the smallest useful idea with its own tests and documentation.
