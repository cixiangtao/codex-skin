# Codex Skin

[访问项目主页 →](https://cixiangtao.github.io/codex-skin/) ·
[查看完整 README →](https://github.com/cixiangtao/codex-skin/blob/main/.github/README.md)

> [!IMPORTANT]
> 此 npm 包只提供面向自动化、开发调试和故障恢复的 Codex Skin CLI，不包含可直接安装的
> Electron 客户端。普通用户的正式分发物是 GitHub Releases 中的 macOS 客户端；客户端完成
> 签名与公证前仍属于开发预览。

## 发布渠道

- **项目主页**通过 GitHub Pages 发布，集中展示产品能力、主题效果和正式下载入口。
- **macOS 客户端**是面向普通用户的主产品，正式版本通过 GitHub Releases 提供 DMG 和 ZIP。
- **npm CLI**是独立的开发与支持渠道，只在 Core、CLI、共享运行时或排障恢复能力变化时按需发布。
- 仅涉及 Electron 界面、图标或桌面打包的变化，不需要同步发布 npm 新版本。

## Electron 客户端（开发预览）

客户端把 Node.js 和后台监听能力一起打包，普通用户不需要单独安装 Node.js。
它与命令行入口共享同一套核心能力和配置目录，关闭设置窗口后仍会继续维护 Codex
主题；从应用菜单退出后才会停止。

客户端是唯一面向普通用户的产品入口。CLI 仅保留用于自动化测试、开发调试、无界面排障和
客户端故障时的兜底恢复，不承载独立业务逻辑。

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

该命令只在本地生成安装包，不会创建 GitHub Release。当前构建尚未接入 Apple Developer
签名与公证，直接分发前需要配置签名身份和公证凭据。

## Codex 主题换装效果

| 浅色主题                                                                                                                                                                      | 深色主题                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 浅色主题换装效果：全局壁纸、主面板人物与侧边栏布景](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-light-theme-preview.jpg) | ![Codex Skin 深色主题换装效果：Codex 全局背景与透明界面](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-dark-theme-preview.jpg) |

| 自定义壁纸                                                                                                                                        | 动漫主题                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 自定义壁纸主题效果](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-wallpaper-theme-preview.jpg) | ![Codex Skin 动漫主题换装效果](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-anime-theme-preview.jpg) |

### 可视化主题设置

![Codex Skin 可视化主题设置页，可配置全局背景、主面板和侧边栏](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-settings.png)
