# 参与 Codex Skin 开发

[English](CONTRIBUTING.md) | 简体中文

Codex Skin 已进入维护模式。开始改动前请先阅读[项目状态](MAINTENANCE.zh-CN.md)。本仓库只接受
关键安全、恢复能力、范围明确的兼容性、文档和迁移改进。新产品功能、跨平台移植、主题包协议和主题
市场不再在这里继续建设；相关贡献请优先考虑提交到
[Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin)。

在上述维护边界内，项目仍以 macOS 桌面客户端为主要产品入口，npm CLI 只承担自动化、开发调试和
故障恢复职责。共享行为应先进入 Core，再由 Electron 或 CLI 调用。

## 开发环境

- Apple Silicon Mac：运行和验证当前桌面客户端所需
- Node.js 22+
- Bun 1.3.14
- 已安装 Codex 桌面端

安装依赖：

```bash
bun install --frozen-lockfile
```

## 开发与验证

```bash
bun run desktop  # 启动 Electron 开发环境
bun run test     # 运行测试
bun run check    # 检查格式、代码和类型
bun run ci       # 执行仓库 CI 的完整本地门禁
```

提交 Pull Request 前，请至少执行与你改动范围对应的检查。涉及共享 Core、CLI、桌面构建、项目主页
或发布配置时，建议执行完整的 `bun run ci`。

## Pull Request

1. 从 `main` 创建独立分支。
2. 保持改动聚焦，避免把功能、重构和文档清理混在同一个提交中。
3. 提交信息使用 Conventional Commits，例如 `fix(runtime): ...` 或 `docs(readme): ...`。
4. 在 Pull Request 中说明用户影响、验证方式和发布渠道影响。
5. 不要提交令牌、认证链接、用户图片、本机配置、包含隐私信息的日志或构建产物。

只有维护者会创建发布标签、GitHub Release 或 npm 版本。发布约束见
[发布流程](docs/release-process.md)。

安全漏洞请不要提交公开 Issue，改用 [安全策略](SECURITY.md) 中的私密报告入口。
