[查看完整 README →](https://github.com/cixiangtao/codex-skin#readme)

## Electron 客户端（开发预览）

客户端把 Node.js 和后台监听能力一起打包，普通用户不需要单独安装 Node.js。
它与命令行入口共享同一套核心能力和配置目录，关闭设置窗口后仍会继续维护 Codex
主题；从应用菜单退出后才会停止。

```bash
bun run desktop
```

生成本机可运行的 macOS 应用：

```bash
bun run desktop:pack
```

生成 DMG 和 ZIP 分发包：

```bash
bun run desktop:dist
```

当前构建尚未接入 Apple Developer 签名与公证，直接分发前需要配置签名身份和公证凭据。

## Codex 主题换装效果

| 浅色主题                                                                                                                                                                      | 深色主题                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 浅色主题换装效果：全局壁纸、主面板人物与侧边栏布景](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-light-theme-preview.jpg) | ![Codex Skin 深色主题换装效果：Codex 全局背景与透明界面](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-dark-theme-preview.jpg) |

| 自定义壁纸                                                                                                                                        | 动漫主题                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 自定义壁纸主题效果](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-wallpaper-theme-preview.jpg) | ![Codex Skin 动漫主题换装效果](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-anime-theme-preview.jpg) |

### 可视化主题设置

![Codex Skin 可视化主题设置页，可配置全局背景、主面板和侧边栏](https://raw.githubusercontent.com/cixiangtao/codex-skin/main/docs/images/codex-skin-settings.png)
