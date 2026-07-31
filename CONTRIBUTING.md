# 参与 Codex Skin 开发

感谢你愿意改进 Codex Skin。项目当前以 macOS 桌面客户端为主要产品入口，npm CLI 只承担自动化、
开发调试和故障恢复职责。新增能力应先进入共享 Core，再由 Electron 或 CLI 调用。

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
