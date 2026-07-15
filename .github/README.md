# Codex Skin：Codex 桌面端主题换装工具

Codex Skin 是一款面向 macOS Codex 桌面端的开源主题换装与界面美化工具。无需修改或重新签名 `ChatGPT.app`，即可通过可视化设置为 Codex 添加全局壁纸、主面板人物布景和侧边栏装饰，自由打造浅色、深色、二次元等个性化 Codex 主题。

> [!IMPORTANT]
> Codex Skin 目前仅支持 macOS，运行前必须准备 Node.js 22+，并已安装 Codex 桌面端。它不是浏览器版 ChatGPT/Codex 的扩展，也不支持 Windows 或 Linux。

## 依赖环境

- macOS
- Node.js 22 或更高版本（需包含 npm 与 `npx`）
- Codex 桌面端；默认安装路径为 `/Applications/ChatGPT.app`

如果 Codex 不在默认路径，可在命令中通过 `--app-path "/实际路径/ChatGPT.app"` 指定。普通用户无需安装 Bun、TypeScript 或项目开发依赖。

## Codex 主题换装效果

| 浅色主题                                                                                                            | 深色主题                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| ![Codex Skin 浅色主题换装效果：全局壁纸、主面板人物与侧边栏布景](../docs/images/codex-skin-light-theme-preview.jpg) | ![Codex Skin 深色主题换装效果：Codex 全局背景与透明界面](../docs/images/codex-skin-dark-theme-preview.jpg) |

| 自定义壁纸                                                                              | 动漫主题                                                                          |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| ![Codex Skin 自定义壁纸主题效果](../docs/images/codex-skin-wallpaper-theme-preview.jpg) | ![Codex Skin 动漫主题换装效果](../docs/images/codex-skin-anime-theme-preview.jpg) |

### 可视化主题设置

![Codex Skin 可视化主题设置页，可配置全局背景、主面板和侧边栏](../docs/images/codex-skin-settings.png)

## 功能特点

- 一键完成 Codex 主题换装，无需修改应用文件或重新签名
- 主面板与侧边栏可使用不同图片，也可以分别启用或关闭
- 支持独立的全局背景图，覆盖整个 Codex 窗口并保留原生半透明侧边栏
- 支持调节 Codex 原背景色的透明度，并自动跟随浅色、深色主题
- 支持拖拽定位，以及大小、透明度、边缘柔化和 X/Y 坐标调节
- 支持 PNG、JPEG、WebP、GIF、AVIF，单张图片最大 25 MB
- 保留 PNG、WebP 图片的透明通道
- 设置保存后立即同步到已连接的 Codex 窗口，新窗口也会自动应用
- 提供环境诊断、效果验证、重载恢复验证和命令行配置能力

## 快速开始

直接运行：

```bash
npx codex-skin
```

该命令会打开本地设置页，以仅回环可访问的 Chrome DevTools Protocol（CDP）端口启动 Codex，自动应用当前配置，并在后台保持所有新窗口同步。Codex 退出后，后台进程也会随之结束。

首次使用且尚未生成配置文件时，全局背景、主面板和侧边栏默认全部关闭，也不会预选图片；Codex 仍会直接启动，因此首次运行不会被图片配置中断，也不会改变原生界面。之后可以在设置页主动选择图片并开启需要的背景层。终端会持续显示设置服务、背景守护进程和 Codex CDP 的端口与 PID，并提供可直接复制的停止命令。

## 可视化设置

设置页提供全局背景、主面板和侧边栏三个独立分区。全局背景可以：

- 从对应模块的内置素材列表快速选择，也可以继续上传自己的图片
- 选择一张窗口级壁纸，并单独启用或关闭
- 调整背景色透明度：0% 保留原色，100% 完全显示壁纸
- 在“覆盖窗口”和“完整显示”之间切换
- 调整横向和纵向焦点位置
- 保留 Codex 原生侧边栏的半透明层次

主面板和侧边栏人物布景分别可以：

- 从各自的内置素材列表快速选择，也可以继续上传自己的图片
- 单独选择图片并控制是否显示
- 直接在预览区拖动人物位置
- 调整人物大小与透明度
- 使用九宫格预设或 X/Y 滑块精确定位
- 调整边缘柔化程度

设置页中的修改会立即应用到当前已连接的 Codex 窗口。旧版单分区配置会自动迁移到主面板，无需手动处理。

## 常用命令

```bash
npx codex-skin                  # 打开设置页并启动背景模式
npx codex-skin settings         # 仅打开设置页
npx codex-skin doctor           # 检查本地运行环境
npx codex-skin verify           # 验证背景是否已正确显示
npx codex-skin verify --reload  # 重载 Codex 后验证恢复能力
npx codex-skin show             # 输出规范化后的当前配置
npx codex-skin stop             # 停止背景与设置服务，并移除已注入的布景
npx codex-skin disable          # 停止布景并持久化禁用状态
npx codex-skin enable           # 重新启用布景配置
```

### 使用命令行配置主面板

```bash
npx codex-skin configure \
  --surface main \
  --image "/图片的绝对路径/character.png" \
  --illustration-size 360 \
  --x 82 \
  --y 76 \
  --opacity 0.72 \
  --blur 0
```

### 独立配置侧边栏

```bash
npx codex-skin configure \
  --surface sidebar \
  --enable-surface \
  --image "/图片的绝对路径/sidebar-character.webp" \
  --illustration-size 240 \
  --x 50 \
  --y 80 \
  --opacity 0.24
```

主面板和侧边栏可以同时启用，二者的图片与外观参数互不影响。

## 配置与本地数据

配置文件和上传的图片默认保存在：

```text
~/.config/codex-skin/
```

可以通过 `CODEX_SKIN_HOME` 修改数据目录。为兼容已有本地环境，旧的 `CODEX_BACKGROUND_HOME` 变量仍然有效。

默认 CDP 端口由工具自动管理。如果端口已被其他进程占用，工具会选择一个空闲的回环端口并保存。也可以手动控制端口策略：

```bash
npx codex-skin configure --port 9229      # 固定使用指定端口
npx codex-skin configure --auto-port      # 恢复自动选择端口
```

只有当端口的所有监听进程都属于当前配置的 Codex 进程树时，工具才会接受该端口。

## 启动机制与安全边界

CDP 参数必须在 Codex 启动时传入。如果 Codex 已经以普通模式运行，工具会询问是否允许重启：

- 确认后，工具会先输出设置服务与等待状态，再由独立后台任务正常退出 Codex、持续轮询进程，最后以仅回环可访问的 CDP 连接重新启动并应用布景；即使 Codex 关闭了当前终端，重启任务也会继续
- 如果 Codex 再次询问是否退出，请在 Codex 中确认；Codex Skin 会一直等到 Codex 完全退出
- 拒绝后，Codex Skin 会直接退出，不会改动正在运行的 Codex

后续建议始终通过 `npx codex-skin` 启动，让背景连接从 Codex 启动阶段即可用。

Codex Skin 不会修改 `app.asar`、`ElectronAsarIntegrity`、应用签名、登录数据或更新程序。设置服务仅监听 `127.0.0.1`，使用随机会话令牌，并在连续 30 分钟没有请求后关闭。CDP 本身没有应用层身份验证，因此请勿将其暴露到网络。

## 本地开发

本地开发额外依赖 [Bun 1.3.14](https://bun.sh/)。Node.js 仍需满足 22+；其余 React、TypeScript、Vite+、Vite、Tailwind CSS 与 Vitest 依赖均由 `bun install` 安装。

```bash
bun install
bun dev          # 同时启动可视化界面与本地接口
bun dev:ui       # 仅启动界面，监听 127.0.0.1:4178
bun dev:server   # 仅启动设置接口，监听 127.0.0.1:4179
bun run test     # 运行测试
bun run check    # 运行代码检查
bun run build    # 构建界面与命令行程序
```

`bun dev` 会启动开发界面与本地接口，然后复用 `npx codex-skin` 的默认启动流程：打开设置页、启动 Codex，并在存在已启用配置时自动应用背景；首次无配置时只启动 Codex，不注入任何背景样式。需要重启已有 Codex 时，同样会把退出轮询与重新启动交给独立后台任务。按下 `Ctrl+C` 后，Vite 与本地接口两个开发子进程会一并停止。

项目使用 Bun 和 TypeScript 开发，设置界面基于 React、Tailwind CSS 4、Vite+ 与 Vite，测试使用 Vitest。npm 包会发布为编译后的 Node.js 可执行程序，最终用户无需安装 Bun 或 TypeScript。

### 内置背景素材

内置素材按模块放在以下目录，设置服务会扫描目录中的图片并动态生成下拉列表，无需维护额外清单：

```text
public/backgrounds/wallpaper/  # 全局背景
public/backgrounds/main/       # 主面板人物或布景
public/backgrounds/sidebar/    # 侧边栏人物或布景
```

支持 PNG、JPEG、WebP、GIF 和 AVIF。文件名去掉扩展名后会作为选项名称，其中短横线和下划线会显示为空格。开发环境中添加或删除素材后刷新设置页即可；发布版本需要重新构建。

## 发布

执行独立的发布前检查，不修改版本号，也不发布包：

```bash
bun run release:check
```

准备发布时启动交互式发布流程：

```bash
bun run release
```

发布命令会自动执行同一套发布前检查，然后更新版本号、创建发布提交与标签、推送到远端，并将编译后的包发布到 npm。

## 语言计划

当前 README 仅维护中文版本。待项目接入 i18n 后，再统一补充英文文档，避免界面与说明的语言支持不一致。

## 开源协议

本项目基于 [MIT 协议](../LICENSE) 开源。
