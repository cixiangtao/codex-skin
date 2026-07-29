---
version: 1
slug: "apps-site-index-html"
primary_target: "apps/site/index.html"
related_targets: ["apps/site/main.tsx", "apps/site/site.css", "vite.site.config.ts"]
---

## Scope

Codex Skin GitHub Pages 项目主页。模式为 Persuade：让第一次到访的 macOS Codex 用户无需先浏览产品介绍，就能在首屏确认支持条件、完成开发预览安装并看懂后续使用路径。

## Audience, job, action

- 受众：已经使用 macOS Codex、想让工作空间更个性化的用户。
- 核心任务：确认当前环境是否支持，复制并运行安装命令，然后按三步开始使用。
- 主行动：复制源码安装命令；次行动：查看完整安装说明与 GitHub 源码。

## Proof and constraints

- 首屏只服务安装与开始使用：直接展示源码命令、运行要求、开发预览限制和三步使用方式。
- 真实浅色主题效果图移到第二层，随后展示设置页和其他已存在效果图。
- 明示不修改 `app.asar`、仅回环连接、三个独立视觉图层。
- 客户端仍是 Apple Silicon 开发预览；不把本地构建描述成正式 Release。
- npm CLI 是开发和支持通道，不是桌面客户端的替代品。
- 仅使用仓库内真实截图与既有图标，不虚构评价、下载量或兼容平台。

## Chosen direction

保留用户批准方案 B 的明亮技术画布：冷白底、石墨色单像素线、品牌绿和浅薄荷色；系统无衬线；开放分区和线性结构，不以等尺寸圆角卡片组织页面。拓扑改为安装任务优先：首屏由安装标题、终端命令、运行条件和三步使用路径构成；真实效果图降为第二层证据，产品能力、安全边界和发布通道依次后移。

## Memorable moment

首屏像一张可立即执行的安装工作台：终端命令是视觉中心，右侧条件表和底部三步路径让用户无需继续寻找即可开始。

## Unresolved

正式签名、公证和 Release 就绪后，需要把开发预览入口替换为真实下载入口并补充版本信息。
