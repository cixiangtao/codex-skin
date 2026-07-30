# Codex Skin

[下载 macOS 预览版（Apple Silicon）→](https://github.com/cixiangtao/codex-skin/releases/download/desktop-v1.1.2-preview.2/Codex-Skin-1.1.2-arm64.dmg) ·
[访问项目主页 →](https://cixiangtao.github.io/codex-skin/) ·
[查看完整 README →](https://github.com/cixiangtao/codex-skin/blob/main/.github/README.md)

> [!IMPORTANT]
> 此 npm 包只提供面向自动化、开发调试和故障恢复的 Codex Skin CLI，不包含可直接安装的
> Electron 客户端。普通用户请下载 GitHub Releases 中的 macOS 客户端；当前预览版仅支持
> Apple Silicon，尚未使用 Apple Developer ID 签名，也未经过 Apple 公证。

## 发布渠道

- **项目主页**通过 GitHub Pages 发布，集中展示产品能力、主题效果和客户端下载入口。
- **macOS 客户端**是面向普通用户的主产品，当前通过 GitHub Releases 提供开发预览 DMG 和
  ZIP。
- **npm CLI**是独立的开发与支持渠道，只在 Core、CLI、共享运行时或排障恢复能力变化时按需发布。
- 仅涉及 Electron 界面、图标或桌面打包的变化，不需要同步发布 npm 新版本。

## Electron 客户端（开发预览）

客户端把 Node.js 和后台监听能力一起打包，普通用户不需要单独安装 Node.js。
它与命令行入口共享同一套核心能力和配置目录，关闭设置窗口后仍会继续维护 Codex
主题；从应用菜单退出后才会停止。

客户端设置页还提供 macOS 菜单栏图标选择器，首期内置经典、像素猫和像素幽灵三种样式；
像素款会逐帧播放动画，选择后立即生效并保存。

客户端是唯一面向普通用户的产品入口。CLI 仅保留用于自动化测试、开发调试、无界面排障和
客户端故障时的兜底恢复，不承载独立业务逻辑。

直接下载：

- [DMG（推荐）](https://github.com/cixiangtao/codex-skin/releases/download/desktop-v1.1.2-preview.2/Codex-Skin-1.1.2-arm64.dmg)
- [ZIP（备用）](https://github.com/cixiangtao/codex-skin/releases/download/desktop-v1.1.2-preview.2/Codex-Skin-1.1.2-arm64.zip)
- [SHA-256 校验值](https://github.com/cixiangtao/codex-skin/releases/download/desktop-v1.1.2-preview.2/SHA256SUMS.txt)

如果 macOS 阻止打开，请先确认下载来源与 SHA-256 校验值；尝试打开一次后，前往“系统设置 →
隐私与安全性”选择“仍要打开”。Apple
[说明了这一安全确认流程](https://support.apple.com/zh-cn/102445)；不信任来源时不要绕过系统
保护。

以下命令仅用于本地开发，不是普通用户的安装步骤：

```bash
bun run desktop
```

该命令通过 electron-vite 启动桌面开发环境。界面代码支持热更新，Electron 主进程代码变化后
会自动重新构建并重启。开发模式直接使用 Electron 宿主，因此 macOS 可能仍将宿主识别为
Electron。

生成并打开名称、图标与正式客户端一致的 `Codex Skin.app`：

```bash
bun run desktop:open
```

生成本机可运行的 macOS 应用：

```bash
bun run desktop:pack
```

生成 DMG 和 ZIP 分发包：

```bash
bun run desktop:dist
```

生成与 GitHub Release 一致的 Apple Silicon 预览包：

```bash
bun run desktop:dist:preview
```

推送格式为 `desktop-v<版本>-preview.<序号>` 的标签后，GitHub Actions 会执行检查、生成
DMG 与 ZIP、验证产物并创建 prerelease。当前构建尚未接入 Apple Developer ID 签名与公证。

## Codex 主题换装效果

| 浅色主题                                                                                                                                                                      | 深色主题                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 浅色主题换装效果：全局壁纸、主面板人物与侧边栏布景](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-light-theme-preview.jpg) | ![Codex Skin 深色主题换装效果：Codex 全局背景与透明界面](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-dark-theme-preview.jpg) |

| 自定义壁纸                                                                                                                                        | 动漫主题                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 自定义壁纸主题效果](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-wallpaper-theme-preview.jpg) | ![Codex Skin 动漫主题换装效果](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-anime-theme-preview.jpg) |

### 可视化主题设置

![Codex Skin 可视化主题设置页，可配置全局背景、主面板和侧边栏](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-settings.png)
