---
version: 1
slug: "apps-site-index-html"
primary_target: "apps/site/index.html"
related_targets: ["apps/site/main.tsx", "apps/site/site.css", "vite.site.config.ts"]
---

## Scope

Codex Skin GitHub Pages 项目主页。模式为 Persuade：让第一次到访的 macOS Codex 用户无需先浏览产品介绍，就能在首屏确认支持条件、下载开发预览并看懂后续使用路径。

## Audience, job, action

- 受众：已经使用 macOS Codex、想让工作空间更个性化的用户。
- 核心任务：确认当前环境是否支持，下载已打包客户端，然后按三步开始使用。
- 主行动：下载 Apple Silicon DMG；次行动：下载备用 ZIP、查看版本说明或从源码构建。

## Proof and constraints

- 首屏只服务下载、安装与开始使用：直接展示 DMG 下载、备用 ZIP、运行要求、开发预览限制和三步使用方式。
- 客户端下载不要求 Node.js 或 Bun；源码命令降级为首屏之后的开发者备用方式。
- 真实浅色主题效果图移到第二层，随后展示设置页和其他已存在效果图。
- 明示不修改 `app.asar`、仅回环连接、三个独立视觉图层。
- 客户端仍是 Apple Silicon 开发预览；明确未使用 Apple Developer ID 签名、未公证，不描述成正式稳定版。
- npm CLI 是开发和支持通道，不是桌面客户端的替代品。
- 仅使用仓库内真实截图与既有图标，不虚构评价、下载量或兼容平台。

## Chosen direction

保留用户批准方案 B 的明亮技术画布：冷白底、石墨色单像素线、品牌绿和浅薄荷色；系统无衬线；开放分区和线性结构，不以等尺寸圆角卡片组织页面。拓扑改为下载任务优先：首屏由下载标题、真实 DMG 入口、运行条件、安全提示和三步使用路径构成；源码构建作为紧随其后的开发者备用方式，真实效果图和产品证据继续后移。

## Memorable moment

首屏像一张可立即执行的下载工作台：真实 DMG 入口是视觉中心，右侧条件表、安全说明和底部三步路径让用户无需继续寻找即可开始。

## Unresolved

完成 Apple Developer ID 签名、公证和 Intel 构建后，需要将预览提示升级为正式分发信息，并补充自动更新策略。
