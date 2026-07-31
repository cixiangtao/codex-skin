# 发布流程

Codex Skin 有三个独立交付面：macOS 桌面客户端、npm CLI 和 GitHub Pages 项目主页。它们共享源码，
但不要求每次同时发布。

## 版本来源

- npm CLI 版本由根目录 `package.json` 的 `version` 管理，使用 `v<version>` 标签。
- 当前公开桌面预览版由 `config/release.json` 管理，使用
  `desktop-v<version>-preview.<number>` 标签。
- 桌面构建仍使用 `package.json` 生成应用包版本。创建桌面发布标签前，发布契约会要求
  `package.json` 与 `config/release.json` 的版本一致。
- Pages 没有独立版本号，始终展示 `config/release.json` 指向的当前公开桌面版本。

这样 npm 可以独立升版而不改变网站上的桌面下载地址；准备新的桌面预览时，再更新桌面版本配置和
文档链接。

## 变更与发布渠道

| 变更范围                          | 桌面 Release | npm CLI           | Pages      |
| --------------------------------- | ------------ | ----------------- | ---------- |
| Electron 主进程、图标、桌面打包   | 需要         | 不需要            | 按文案需要 |
| Core、CLI、共享运行时、打包设置页 | 需要时发布   | 需要              | 按文案需要 |
| 项目主页                          | 不需要       | 不需要            | 需要       |
| 纯文档                            | 按链接变化   | 下一次 npm 包携带 | 按页面变化 |

## 本地门禁

```bash
bun install --frozen-lockfile
bun run ci
```

`bun run ci` 会按顺序执行格式、lint、类型、测试、发布契约、npm 打包预检、Electron 构建和 Pages
构建。会清理或复用相同输出目录的任务保持串行。

## 仓库策略

- `Repository CI` 在 Pull Request 和 `main` push 上运行完整门禁。
- `main` ruleset 应要求 `Validate public products` 检查通过。必须先让 CI 工作流进入默认分支，再绑定
  必需检查，避免把首个配置提交锁在分支规则之外。
- 工作流中的外部 Action 使用完整提交 SHA；远端“Require actions to be pinned to a full-length
  commit SHA”同样应在这些工作流进入默认分支后启用。
- Pages 工作流只拥有 `contents: read`、`pages: write` 和 `id-token: write`；桌面 Release 工作流
  只在标签触发时拥有 `contents: write`。

## 发布桌面预览

1. 确认准备发布的提交已经进入 `main`。
2. 更新 `config/release.json` 中的桌面版本和 Preview 序号。
3. 同步 `.github/README.md` 中的公开下载链接。
4. 执行 `bun run ci`。
5. 创建并推送 `desktop-v<version>-preview.<number>` 标签。
6. GitHub Actions 再次执行检查、构建并验证 DMG、ZIP 和 SHA-256。
7. 工作流创建 prerelease，并由 GitHub 根据提交差异生成本次更新列表。
8. 检查 Release 标签、资产、校验值、Pages 下载入口和真实下载行为。

工作流会拒绝不在 `main` 历史中的标签，也会拒绝与发布契约不一致的版本。

## 发布 npm CLI

只有 Core、CLI、共享运行时、打包设置页或诊断恢复能力变化时才发布 npm：

```bash
bun run release:check
bun run release
```

`release-it` 负责版本提交、`v<version>` 标签、推送和 npm 发布。发布后必须独立核对 npm
`latest`、包元数据、压缩包内容，并从仓库外的临时目录运行 CLI。npm 发布不会创建桌面安装包。

## 恢复边界

- 标签或 Release 创建失败时，先核对本地/远端标签和 Release 状态，避免重复创建。
- npm 发布失败时，检查版本文件、暂存区、远端标签和 registry 状态，不假设发布工具已经完全回滚。
- Pages、GitHub Release 和 npm 是独立交付面，任何一个成功都不代表其他交付面已经更新。
