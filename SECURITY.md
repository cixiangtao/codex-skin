# Security Policy

English | [简体中文](SECURITY.zh-CN.md)

Security fixes target the latest macOS desktop preview and npm `latest`. Older versions may need an upgrade before a fix is available.

Report vulnerabilities through [GitHub Private Vulnerability Reporting](https://github.com/cixiangtao/codex-skin/security/advisories/new), not a public issue. Include the Codex Skin version, release tag and entry point, macOS and chip architecture, Codex desktop version, minimal reproduction, sanitized evidence, impact, and attempted mitigations. Never include tokens, usernames, private paths, personal data, or another person's data.

Codex Skin uses a loopback-only settings service and Chrome DevTools Protocol connection. Do not expose either port to a LAN or the internet. Desktop previews are currently neither Developer ID signed nor notarized; download them from this repository's GitHub Release and verify the published SHA-256 checksum.

The project does not promise a fixed response time. Confirmed issues are coordinated in the private advisory thread.
