---
version: 1
slug: "apps-site-index-html"
primary_target: "apps/site/index.html"
related_targets: ["apps/site/main.tsx", "apps/site/site.css", "vite.site.config.ts"]
---

## Scope

Codex Skin GitHub Pages 项目主页。模式为 Persuade：让第一次到访的 macOS Codex 用户先看懂产品，再立即找到开发预览的安装与使用方式，并继续验证产品效果和实现边界。

## Audience, job, action

- 受众：已经使用 macOS Codex、想让工作空间更个性化的用户。
- 核心任务：确认它改变什么、当前如何安装和使用，以及是否会修改 Codex 文件。
- 主行动：从源码安装 Apple Silicon 开发预览；次行动：查看 GitHub 源码与完整说明。

## Proof and constraints

- 首屏使用真实浅色主题效果图；其后立即展示安装命令、运行要求和三步使用方式，再展示设置页与其他已存在效果图。
- 明示不修改 `app.asar`、仅回环连接、三个独立视觉图层。
- 客户端仍是 Apple Silicon 开发预览；不把本地构建描述成正式 Release。
- npm CLI 是开发和支持通道，不是桌面客户端的替代品。
- 仅使用仓库内真实截图与既有图标，不虚构评价、下载量或兼容平台。

## Chosen direction

用户批准方案 B：效果图主导的明亮技术画布。冷白底、石墨色单像素线、品牌绿和浅薄荷色；系统无衬线；开放分区和线性结构，不以等尺寸圆角卡片组织页面。首屏标题、动作和真实 Codex 效果图共处一条明确基线，截图下方用细线标出全局壁纸、主面板和侧边栏三层。信息顺序优先服务实际任务：真实效果之后立即进入安装与使用，产品能力、安全边界和发布通道依次后移。

## Memorable moment

首屏的大幅真实 Codex 窗口像工作台上的核心证据，三条标注线把视觉变化直接连接到产品的三个可控图层。

## Unresolved

正式签名、公证和 Release 就绪后，需要把开发预览入口替换为真实下载入口并补充版本信息。
