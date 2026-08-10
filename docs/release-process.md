# Release process

English | [简体中文](release-process.zh-CN.md)

Codex Skin has three independent delivery surfaces: the macOS desktop client, npm CLI, and GitHub Pages site. They share source but do not need to ship together.

## Version sources

- npm CLI: `package.json`, tag `v<version>`
- Desktop preview: `config/release.json`, tag `desktop-v<version>-preview.<number>`
- Pages: no independent version; it presents the desktop version from `config/release.json`

Desktop packaging still reads `package.json`, so the release contract requires its version to match `config/release.json` before a desktop tag is created. npm can otherwise release independently without changing the site download.

## Delivery matrix

| Change                                         | Desktop Release   | npm CLI            | Pages                 |
| ---------------------------------------------- | ----------------- | ------------------ | --------------------- |
| Electron process, icons, packaging             | Required          | No                 | When copy changes     |
| Core, CLI, shared runtime, bundled settings UI | As needed         | Required           | When copy changes     |
| Project site                                   | No                | No                 | Required              |
| Documentation only                             | When links change | Included next time | When the site changes |

## Local gate

```bash
bun install --frozen-lockfile
bun run ci
```

`bun run ci` runs formatting, linting, types, tests, release-contract checks, npm pack verification, Electron build, and Pages build in a safe sequence.

## Repository policy

- `Repository CI` runs for pull requests and pushes to `main`.
- The protected `main` branch requires pull requests and `Validate public products`; administrators cannot bypass the rule.
- Release Please owns the constrained npm release PR. Desktop previews use a separate constrained release PR.
- Third-party Actions are pinned to full commit SHAs.
- Pages has only `contents: read`, `pages: write`, and `id-token: write`; desktop release receives `contents: write` only on tag execution.

## Desktop preview

1. Merge product changes through ordinary pull requests into `main`.
2. Create `release/desktop-v<version>-preview.<number>` from current `main`.
3. Update `config/release.json`, align `package.json` and `bun.lock` when required, and update public download links in `.github/README.md`.
4. Run `bun run ci` and open a release PR containing only approved release files.
5. Merge after `Validate public products` passes.
6. GitHub Actions verifies the merged PR and constrained diff, then builds and verifies the DMG, ZIP, and SHA-256 file.
7. The same workflow creates the desktop tag on the merge commit and publishes a prerelease.
8. Verify the tag, assets, checksum, Pages link, and real download behavior.

Manual tags and workflow dispatch are not desktop release entry points.

## npm CLI

Release Please maintains one PR from `release-please--branches--main--...`; Conventional Commit or squash-merge titles determine SemVer and `CHANGELOG.md`. Maintainers review the constrained diff, version, changelog, and required CI, then merge when ready. `release-npm.yml` verifies the exact merge, runs the complete gate and package inspection, creates `v<version>`, publishes through npm trusted publishing, and creates the GitHub Release.

Do not bump versions, create release tags, or run `npm publish` locally. Configure npm trusted publishing for `cixiangtao/codex-skin` and `release-npm.yml`, and provide `RELEASE_APP_CLIENT_ID` plus `RELEASE_APP_PRIVATE_KEY` for the installed GitHub App that maintains release PRs.

After publication, compare the GitHub Release, npm `latest`, metadata, tarball contents, and a fresh CLI execution outside the repository.

## Recovery

- For a failed npm automation run, compare the merged release PR, tag, GitHub Release, and registry before dispatching the recovery path with the exact PR number.
- Before retrying tag or Release creation, inspect local and remote tag state.
- After npm failure, inspect version files, the index, remote tags, and registry rather than assuming rollback.
- Pages, GitHub Releases, desktop artifacts, and npm are independent states; report each separately.
