---
name: "Codex Skin"
description: "以真实 Codex 效果为第一证据的明亮、克制主题工具视觉系统。"
colors:
  canvas: "#f8fbf9"
  surface: "#ffffff"
  ink: "#18241e"
  muted: "#536159"
  line: "#d5dfd9"
  brand: "#1f7a55"
  brand-strong: "#176342"
  mint: "#ccebdc"
  mint-soft: "#edf8f2"
  signal: "#f4b83f"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(2.75rem, 4.2vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(2rem, 3.2vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.333
    letterSpacing: "-0.025em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.429
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.429
rounded:
  lg: "8px"
  full: "9999px"
spacing:
  base: "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "20": "80px"
  "24": "96px"
  "28": "112px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.brand-strong}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 20px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brand}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
  button-outline-hover:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
  proof-frame:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "6px"
  release-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "28px"
---

# Design System: Codex Skin

## Overview

**Creative North Star: "明亮工作台"**

Codex Skin 把界面当成一张冷静、开放的技术工作台：真实产品效果占据视觉中心，细线、留白和线性标注负责解释，而不是用装饰性海报或功能卡片替代证据。整体保持浅色、明亮、克制，让个性化图片可以变化，信息结构仍然稳定。

这个系统用冷白和浅薄荷建立低对比层次，用石墨色文字与单像素边界保持精度。品牌绿只在动作、编号和关键连接处出现；圆角和阴影受严格限制，避免页面滑向暖纸张、编辑杂志、复古贴纸或高装饰密度。

**Key Characteristics:**

- 真实产品截图先于装饰和抽象功能图。
- 冷白画布、浅薄荷分区与石墨细线共同组织层级。
- 系统无衬线承担全部信息层级，等宽字体只标记命令。
- 开放分区和横向工作台编排优先于等尺寸圆角卡片。
- 品牌绿稀少而明确，黄色只表达预览或状态信号。

## Colors

调色板以低饱和冷色中性层为底，绿色负责动作和结构，黄色只做小面积状态提示。

### Primary

- **工作台绿** (`{colors.brand}`): 用于主动作、编号、项目符号、关键连线与可交互文字。
- **深工作台绿** (`{colors.brand-strong}`): 只用于主动作的悬停加深，保持状态变化清晰。

### Secondary

- **标注薄荷** (`{colors.mint}`): 用于文字选择和轻量反馈，不作为大面积内容底色。
- **雾薄荷** (`{colors.mint-soft}`): 用于整段主题分区、示意图填充和低对比背景层。

### Tertiary

- **预览黄** (`{colors.signal}`): 用于开发预览和窗口状态点；面积保持极小。

### Neutral

- **冷白画布** (`{colors.canvas}`): 页面默认背景与导航底色。
- **纯白表面** (`{colors.surface}`): 截图框、结构表和发布面板。
- **石墨墨色** (`{colors.ink}`): 标题、正文重点和主要图标。
- **灰绿说明色** (`{colors.muted}`): 次级文案、图注和支持信息。
- **冷灰绿线** (`{colors.line}`): 所有单像素边界、分隔线和结构示意。

### Named Rules

**The Green Is a Signal Rule.** 品牌绿只标记动作、索引和结构连接；不要把整屏内容涂成绿色。

**The Cool Canvas Rule.** 大面积底色只在冷白、纯白和浅薄荷之间切换；不要引入暖纸张色。

## Typography

**Display Font:** 系统无衬线 (`{typography.display}`)
**Body Font:** 系统无衬线 (`{typography.body}`)
**Label/Mono Font:** 系统无衬线与系统等宽 (`{typography.label}` / `{typography.code}`)

**Character:** 字体保持原生、直接、低修饰。大标题依靠字号和略紧字距建立张力，正文以宽松行高保证中文长段阅读。

### Hierarchy

- **Display** (`{typography.display}`): 只用于首屏主标题，轻字重、紧字距，优先保持一条清晰基线。
- **Headline** (`{typography.headline}`): 用于主要分区标题；允许在移动端自然换成两到三行。
- **Title** (`{typography.title}`): 用于发布渠道等局部标题。
- **Body** (`{typography.body}`): 用于解释产品能力与边界，正文行宽通常控制在 34–48rem。
- **Label** (`{typography.label}`): 用于动作、导航、图层名称和短标签。
- **Code** (`{typography.code}`): 只用于终端标识与可复制命令。

### Named Rules

**The Single Voice Rule.** 不引入展示性衬线或装饰字体；层级只通过系统字体的尺寸、字重、行高和字距建立。

## Layout

页面使用最大宽度 80rem 的居中容器，两侧最小留白各 1rem。桌面主要叙事采用 12 列网格，在 64rem 断点形成 7/5、8/4 等不对称分配；移动端回落为单列，并保留标题、动作、证据、解释的阅读顺序。

空间基于 4px 节奏。常规组件间距集中在 8–40px，主要分区在移动端使用 `{spacing.20}`，桌面端使用 `{spacing.24}` 或 `{spacing.28}`。响应式断点依次为 40rem、48rem、64rem 和 80rem；导航在 48rem 以下隐藏中间锚点，但保留品牌与 GitHub 行动。

**The Open Section Rule.** 用留白、整段浅色带和单像素分隔线组织内容；不要把每个概念都包进同尺寸卡片。

## Elevation & Depth

系统默认是平的，层级主要来自色调切换、边界和留白。只有首要产品证据使用环境阴影（`0 24px 70px rgb(22 43 33 / 0.12)`）；主按钮使用更紧的动作阴影（`0 8px 20px rgb(31 122 85 / 0.18)`），悬停时变为 `0 12px 24px rgb(31 122 85 / 0.22)`。

### Shadow Vocabulary

- **证据浮层** (`box-shadow: 0 24px 70px rgb(22 43 33 / 0.12)`): 只托起首要真实产品截图。
- **动作静止** (`box-shadow: 0 8px 20px rgb(31 122 85 / 0.18)`): 只用于实心主按钮。
- **动作悬停** (`box-shadow: 0 12px 24px rgb(31 122 85 / 0.22)`): 与轻微上移共同确认主动作可交互。

### Named Rules

**The Flat-by-Default Rule.** 内容面板、图层表和分区在静止状态保持平面；阴影只服务于首要证据和主动作。

## Shapes

主要内容容器、截图框、结构表和发布面板使用直角与单像素边框。8px 圆角只用于按钮和紧凑控制标识；完全圆形只用于编号、项目符号和状态点。示意图可以使用 3px 的微圆角模拟窗口，但它不是可复用表面半径。

**The Frame, Not Card Rule.** 优先使用直角细线框架表达结构；不要给每个内容单元添加圆角、阴影和独立底色。

## Components

### Buttons

- **Shape:** 轻圆角 (`{rounded.lg}`)，最小触控高度 44px。
- **Primary:** 使用 `{components.button-primary}`；实心品牌绿配白字和向下箭头。
- **Hover / Focus:** 悬停切换到 `{components.button-primary-hover}`、上移 2px 并加强阴影；键盘焦点使用 2px 品牌绿轮廓，外移 4px。
- **Outline:** 使用 `{components.button-outline}`；单像素品牌绿边框，悬停切换为 `{components.button-outline-hover}`。
- **Text Link:** 保持透明，使用 1px 下划线；悬停转品牌绿，外链箭头横向和纵向各移动 2px。

### Cards / Containers

- **Corner Style:** 主要容器保持直角；不使用卡片式统一圆角。
- **Background:** 证据与发布面板使用 `{colors.surface}`，页面与段落带在 `{colors.canvas}` 和 `{colors.mint-soft}` 之间切换。
- **Shadow Strategy:** 仅首要截图框使用证据浮层；普通截图、结构表和发布面板只使用边框。
- **Border:** 统一使用 `{colors.line}` 的 1px 实线。
- **Internal Padding:** 截图框从 `{components.proof-frame}` 起步，内容面板从 `{components.release-panel}` 起步并在宽屏增加。

### Navigation

顶部导航高 72px，以品牌图标和名称为左锚点、GitHub 为右锚点。桌面锚点使用次级文字色，悬停转品牌绿，并以 180ms 从右向左展开 1px 下划线；移动端隐藏中间锚点。所有外链保留向右上箭头。

### Linear Annotations

图层标注用 1px 品牌绿水平线与垂直短线连接截图和说明。三层说明在桌面横排、移动端纵排；编号使用 24px 圆形品牌绿徽标。线条动画使用强调式缓出，并在用户偏好减少动态时近乎立即完成。

## Do's and Don'ts

### Do:

- **Do** 在需要证明产品能力的页面优先使用真实产品截图，并给截图足够大的连续面积。
- **Do** 使用冷白、纯白和浅薄荷整段分区，再用 1px 冷灰绿线建立结构。
- **Do** 把品牌绿集中在动作、编号和线性标注上，让其稀缺性保持清晰。
- **Do** 保留清晰的键盘焦点，并尊重 `prefers-reduced-motion`。
- **Do** 让移动端沿同一叙事顺序自然堆叠，不裁掉关键文案或行动。

### Don't:

- **Don't** 使用暖纸张、编辑杂志、复古贴纸或高装饰密度的视觉语言。
- **Don't** 用装饰性海报、虚构指标或通用功能卡片替代真实产品证据。
- **Don't** 把开放分区改造成一组等尺寸、重圆角、带阴影的卡片。
- **Don't** 扩大黄色状态色的面积，或让品牌绿成为大面积内容底色。
- **Don't** 让背景图片、人物或动效损害 Codex 原有信息层级和可读性。
