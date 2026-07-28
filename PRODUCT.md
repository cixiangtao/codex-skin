# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要用户是已经使用 macOS Codex 桌面端、希望在不修改 Codex 应用文件的前提下个性化工作空间的
用户。开发者和支持人员是次要用户，他们通过 npm CLI 完成自动化、诊断和故障恢复。

## Product Purpose

Codex Skin 为 Codex 桌面端提供可视化主题设置和持续运行的背景服务。用户可以分别配置全局壁纸、
主面板人物和侧边栏布景，并让当前与新打开的 Codex 窗口保持一致。

## Positioning

产品不修改 `app.asar`、应用签名、登录数据或更新程序，而是通过仅回环可访问的调试连接为正在
运行的 Codex 窗口应用样式。桌面客户端和 CLI 共享同一套 Core、配置格式与状态判断。

## Operating Context

产品当前面向 Apple Silicon Mac，需要已安装 Codex 桌面端。普通用户通过 Codex Skin 客户端完成
启动、设置和日常运行；关闭设置窗口后客户端继续维护主题，从应用菜单退出后才停止。配置和用户
图片保存在本机。

## Capabilities and Constraints

- 支持全局壁纸、主面板和侧边栏三个独立视觉图层。
- 支持自定义图片、内置素材、拖拽定位、大小、透明度、柔化和焦点调节。
- macOS 客户端是普通用户的主产品，npm CLI 只承担开发和支持职责。
- 客户端仍处于开发预览，尚未完成 Apple Developer 签名、公证和 Intel Mac 构建。
- 项目主页由 GitHub Pages 发布，正式客户端分发物应来自 GitHub Releases。
- 不得把本地构建描述为已经公开发布，也不得暗示尚未实现的平台支持。

## Brand Commitments

保留 `Codex Skin` 名称和现有圆形三点图标。文案以中文为主，表达直接、克制、准确。项目主页采用
线条型、偏简约、浅色且明亮的视觉语言，不使用暖纸张、编辑杂志、复古贴纸或高装饰密度风格。

## Evidence on Hand

- 客户端图标：`apps/desktop/build/icon.svg`
- 浅色、深色、动漫和自定义壁纸效果图：`docs/images/`
- 可视化设置页截图：`docs/images/codex-skin-settings.png`
- 产品与发布边界：`docs/architecture/desktop-first.md`
- 当前没有可用于展示的客户名单、用户评价、下载量或性能基准，不得虚构。

## Product Principles

- 桌面客户端优先，CLI 按需独立发布。
- 不修改 Codex 应用文件，所有用户数据保留在本机。
- 新能力先进入共享 Core，再由客户端和 CLI 调用。
- 公开页面只陈述经过实现或验证的能力与发布状态。
- 个性化不应牺牲 Codex 原生界面的可读性和使用习惯。
