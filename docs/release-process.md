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
- `main` ruleset 必须要求通过 Pull Request 合入并通过 `Validate public products`；管理员也不能绕过。
- Release PR 只允许修改当前交付面的版本、锁文件、发布配置和公开下载链接，不能夹带产品代码。
- 工作流中的外部 Action 使用完整提交 SHA；远端“Require actions to be pinned to a full-length
  commit SHA”同样应在这些工作流进入默认分支后启用。
- Pages 工作流只拥有 `contents: read`、`pages: write` 和 `id-token: write`；桌面 Release 工作流
  只在标签触发时拥有 `contents: write`。

## 发布桌面预览

1. 确认准备发布的产品提交均已通过普通 PR 进入 `main`。
2. 从最新 `main` 创建 `release/desktop-v<version>-preview.<number>` 分支。
3. 在该分支更新 `config/release.json`、必要时同步 `package.json` 与 `bun.lock`，并更新
   `.github/README.md` 中的公开下载链接。
4. 执行 `bun run ci`，然后创建只包含上述发布文件的 Release PR。
5. Release PR 通过 `Validate public products` 后合入 `main`。
6. GitHub Actions 反查该合并 PR、验证受限 diff，再构建并验证 DMG、ZIP 和 SHA-256。
7. 同一工作流在合并提交上创建 `desktop-v<version>-preview.<number>` 标签和 prerelease。
8. 检查 Release 标签、资产、校验值、Pages 下载入口和真实下载行为。

手工标签和 workflow dispatch 都不是发布入口；工作流只接受已合并的桌面 Release PR。

## 发布 npm CLI

只有 Core、CLI、共享运行时、打包设置页或诊断恢复能力变化时才发布 npm：

```bash
git switch -c release/npm-v<version> main
bun run release:check
bun run release:prepare -- <version>
```

`release-it` 只更新版本和 `bun.lock` 并创建本地发布提交。将该分支推送后创建只包含
`package.json` 与 `bun.lock` 的 Release PR；合入后，GitHub Actions 在合并提交上创建
`v<version>` 标签，并通过 npm trusted publishing 发布。发布后必须独立核对 npm `latest`、包元数据、
压缩包内容，并从仓库外的临时目录运行 CLI。npm 发布不会创建桌面安装包。

首次使用该流程前，需要在 npm 包设置中将 trusted publisher 配置为 GitHub Actions、仓库
`cixiangtao/codex-skin`、工作流 `release-npm.yml`，并允许 `npm publish`；仓库不保存长期 npm 发布令牌。

## 恢复边界

- 标签或 Release 创建失败时，先核对本地/远端标签和 Release 状态，避免重复创建。
- npm 发布失败时，检查版本文件、暂存区、远端标签和 registry 状态，不假设发布工具已经完全回滚。
- Pages、GitHub Release 和 npm 是独立交付面，任何一个成功都不代表其他交付面已经更新。
