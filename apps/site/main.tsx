import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"

import releaseConfig from "../../config/release.json"
import animeThemePreviewUrl from "../../docs/images/codex-skin-anime-theme-preview.jpg"
import darkThemePreviewUrl from "../../docs/images/codex-skin-dark-theme-preview.jpg"
import lightThemePreviewUrl from "../../docs/images/codex-skin-light-theme-preview.jpg"
import settingsPreviewUrl from "../../docs/images/codex-skin-settings.png"
import wallpaperThemePreviewUrl from "../../docs/images/codex-skin-wallpaper-theme-preview.jpg"
import iconUrl from "../desktop/build/icon.svg"

import "./site.css"

const githubUrl = "https://github.com/cixiangtao/codex-skin"
const releasesUrl = `${githubUrl}/releases`
const npmUrl = "https://www.npmjs.com/package/codex-skin"
const desktopPreviewVersion = releaseConfig.desktop.version
const desktopPreviewTag = `desktop-v${desktopPreviewVersion}-preview.${releaseConfig.desktop.preview}`
const desktopReleaseUrl = `${releasesUrl}/tag/${desktopPreviewTag}`
const desktopDmgUrl = `${releasesUrl}/download/${desktopPreviewTag}/Codex-Skin-${desktopPreviewVersion}-arm64.dmg`
const desktopZipUrl = `${releasesUrl}/download/${desktopPreviewTag}/Codex-Skin-${desktopPreviewVersion}-arm64.zip`
const desktopChecksumsUrl = `${releasesUrl}/download/${desktopPreviewTag}/SHA256SUMS.txt`
const installCommand =
  "git clone \\\nhttps://github.com/cixiangtao/codex-skin.git\ncd codex-skin\nbun install\nbun run desktop:open"

function ArrowUpRight({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 14 14 6M7 6h7v7" />
    </svg>
  )
}

function ArrowDown({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M10 3v10m-4-4 4 4 4-4M4 17h12" />
    </svg>
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      className="inline-flex items-center gap-3 font-semibold tracking-[-0.02em] text-ink"
      href="#top"
      aria-label="Codex Skin 首页"
    >
      <img
        className={compact ? "size-8" : "size-9"}
        src={iconUrl}
        alt=""
        width={compact ? 32 : 36}
        height={compact ? 32 : 36}
      />
      <span className={compact ? "text-sm" : "text-base"}>Codex Skin</span>
    </a>
  )
}

function Header() {
  return (
    <header className="border-line border-b bg-canvas/95">
      <div className="mx-auto flex h-18 w-[min(calc(100%_-_2rem),80rem)] items-center justify-between">
        <Brand />
        <nav className="text-muted hidden items-center gap-8 text-sm md:flex" aria-label="主导航">
          <a className="nav-link" href="#install">
            安装
          </a>
          <a className="nav-link" href="#usage">
            使用步骤
          </a>
          <a className="nav-link" href="#preview">
            实际效果
          </a>
        </nav>
        <a
          className="group inline-flex items-center gap-2 text-sm font-medium text-ink"
          href={githubUrl}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
          <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </div>
    </header>
  )
}

const installSteps = [
  {
    title: "下载并安装",
    description: "打开 DMG，将 Codex Skin 拖入“应用程序”文件夹。",
  },
  {
    title: "打开并设置主题",
    description: "选择图片，开启全局壁纸、主面板或侧边栏，再调整位置与透明度。",
  },
  {
    title: "回到 Codex 工作",
    description: "设置会同步到当前与新窗口；关闭设置页仍会保持主题。",
  },
]

type CopyState = "idle" | "copied" | "failed"

function CopyInstallCommand() {
  const [state, setState] = useState<CopyState>("idle")

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(installCommand)
      setState("copied")
    } catch {
      setState("failed")
    }
  }

  const label = state === "copied" ? "已复制" : state === "failed" ? "请手动复制" : "复制命令"

  return (
    <button
      className="bg-brand hover:bg-brand-strong focus-visible:outline-brand inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
      type="button"
      onClick={copyCommand}
    >
      <span aria-live="polite">{label}</span>
    </button>
  )
}

function InstallHero() {
  return (
    <section id="install" className="border-line bg-mint-soft border-b">
      <div className="mx-auto flex min-h-[calc(100svh-4.5rem)] w-[min(calc(100%_-_2rem),80rem)] flex-col py-8 sm:py-14 lg:justify-center lg:py-16">
        <div className="grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-6">
          <h1 className="max-w-[11ch] text-[clamp(2.75rem,5vw,4.5rem)] leading-[1.04] font-normal tracking-[-0.03em] text-balance text-ink lg:col-span-7">
            下载并开始使用
          </h1>
          <div className="lg:col-span-5">
            <p className="text-muted max-w-[38rem] text-sm leading-6 sm:text-base sm:leading-7">
              下载已经打包好的 macOS 客户端，通过可视化设置页布置你的 Codex 工作空间。无需安装
              Node.js 或 Bun。
            </p>
            <p className="text-muted mt-3 flex items-start gap-2 text-xs leading-5 sm:mt-4 sm:text-sm">
              <span
                className="bg-signal mt-1.5 size-2 shrink-0 rounded-full"
                aria-hidden="true"
              ></span>
              <span>
                v{desktopPreviewVersion} · Apple Silicon · 未使用 Developer ID 签名、未公证
              </span>
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:mt-8 sm:gap-8 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-12">
          <div className="install-stage min-w-0 lg:col-span-7">
            <div className="border-line border bg-white">
              <div className="border-line flex items-center justify-between gap-6 border-b px-5 py-3 sm:px-6">
                <span className="text-muted font-mono text-xs">Codex Skin for macOS</span>
                <span className="text-muted text-xs">arm64 · DMG</span>
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-4 p-4 sm:gap-7 sm:p-7">
                <img className="size-12 sm:size-20" src={iconUrl} alt="" width="80" height="80" />
                <div>
                  <p className="text-xl font-semibold tracking-[-0.025em] text-ink">
                    Codex Skin {desktopPreviewVersion}
                  </p>
                  <p className="text-muted mt-2 text-sm leading-6">
                    面向 Apple Silicon Mac 的桌面客户端预览版。
                  </p>
                </div>
              </div>
              <div className="border-line grid grid-cols-[1fr_auto] items-center gap-3 border-t p-4 sm:p-6">
                <a
                  className="bg-brand hover:bg-brand-strong focus-visible:outline-brand inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition-colors"
                  href={desktopDmgUrl}
                >
                  <ArrowDown className="size-4" />
                  下载 DMG
                </a>
                <a
                  className="group decoration-line hover:text-brand inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-ink underline decoration-1 underline-offset-4 transition-colors"
                  href={desktopZipUrl}
                >
                  备用 ZIP
                  <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </a>
              </div>
            </div>
          </div>

          <h2 className="sr-only">使用步骤</h2>
          <ol
            id="usage"
            className="border-line grid grid-cols-3 border-y lg:col-span-12 lg:row-start-2"
          >
            {installSteps.map((step, index) => (
              <li
                className="border-line flex flex-col gap-3 border-r px-2 py-4 last:border-r-0 sm:px-4 lg:grid lg:grid-cols-[2rem_1fr] lg:gap-4 lg:px-6 lg:py-5"
                key={step.title}
              >
                <span className="border-brand text-brand grid size-7 place-items-center rounded-full border text-xs font-semibold">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <p className="text-muted mt-1 hidden text-sm leading-6 sm:mt-2 sm:block">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <dl className="border-line divide-line divide-y border-y py-2 text-sm">
              <div className="flex items-start justify-between gap-6 py-3">
                <dt className="text-muted shrink-0">系统</dt>
                <dd className="text-right font-medium text-ink">macOS · Apple Silicon</dd>
              </div>
              <div className="flex items-start justify-between gap-6 py-3">
                <dt className="text-muted shrink-0">需要</dt>
                <dd className="max-w-[22rem] text-right font-medium text-ink">
                  Codex 桌面端 · 无需 Node.js 或 Bun
                </dd>
              </div>
              <div className="flex items-start justify-between gap-6 py-3">
                <dt className="text-muted shrink-0">安全</dt>
                <dd className="max-w-[22rem] text-right font-medium text-ink">
                  未使用 Apple Developer ID 签名、未公证
                </dd>
              </div>
            </dl>

            <p className="text-muted mt-5 text-xs leading-5">
              若 macOS 阻止打开，请先核对下载来源和
              <a
                className="decoration-line hover:text-brand mx-1 text-ink underline underline-offset-4"
                href={desktopChecksumsUrl}
              >
                SHA-256
              </a>
              ，尝试打开一次后前往“系统设置 → 隐私与安全性”选择“仍要打开”。
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                className="group border-brand text-brand hover:bg-brand inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:text-white"
                href={desktopReleaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                查看版本说明
                <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              <a
                className="group decoration-line hover:text-brand inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-ink underline decoration-1 underline-offset-4 transition-colors"
                href="#source-build"
              >
                从源码构建
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SourceBuild() {
  return (
    <section id="source-build" className="border-line border-b bg-white">
      <div className="mx-auto grid w-[min(calc(100%_-_2rem),80rem)] gap-8 py-14 lg:grid-cols-12 lg:items-center lg:py-16">
        <div className="lg:col-span-5">
          <p className="text-brand font-mono text-xs tracking-[0.08em] uppercase">
            Developer option
          </p>
          <h2 className="mt-3 text-[clamp(1.75rem,2.8vw,2.5rem)] leading-tight font-medium tracking-[-0.03em] text-ink">
            也可以从源码构建
          </h2>
          <p className="text-muted mt-4 max-w-[32rem] text-sm leading-6">
            这是面向开发者的备用方式，需要 Node.js 22+ 与 Bun 1.3.14。普通用户直接下载上方 DMG
            即可。
          </p>
        </div>
        <div className="min-w-0 lg:col-span-7">
          <div className="border-line border bg-canvas">
            <div className="border-line flex items-center justify-between gap-6 border-b px-5 py-3 sm:px-6">
              <span className="text-muted font-mono text-xs">Terminal</span>
              <CopyInstallCommand />
            </div>
            <pre className="max-w-full overflow-x-auto p-4 text-xs leading-6 whitespace-pre text-ink sm:p-6 sm:text-sm sm:leading-7">
              <code>{installCommand}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}

function ProductProof() {
  return (
    <section id="preview" className="mx-auto w-[min(calc(100%_-_2rem),80rem)] py-20 lg:py-28">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
        <h2 className="max-w-[15ch] text-[clamp(2rem,3.2vw,3rem)] leading-tight font-medium tracking-[-0.03em] text-ink lg:col-span-7">
          安装以后，再把 Codex 布置成你的工作空间
        </h2>
        <p className="text-muted max-w-[34rem] text-base leading-7 lg:col-span-5">
          用可视化客户端设置全局壁纸、主面板人物与侧边栏布景。当前与新开的 Codex 窗口会同步应用。
        </p>
      </div>

      <figure className="mt-10 sm:mt-12">
        <div className="border-line border bg-white p-1.5 shadow-[0_24px_70px_rgb(22_43_33_/_0.12)] sm:p-2.5">
          <img
            className="bg-mint-soft aspect-[4/3] w-full object-cover object-left sm:aspect-[1800/1118]"
            src={lightThemePreviewUrl}
            alt="Codex Skin 浅色主题实际效果：窗口中显示全局壁纸、主面板人物和侧边栏人物"
            width="1800"
            height="1118"
            fetchPriority="high"
          />
        </div>
        <figcaption className="border-line grid border-x border-b bg-canvas md:grid-cols-3">
          {[
            ["全局壁纸", "铺在 Codex 内容层之下"],
            ["主面板", "独立控制人物与焦点"],
            ["侧边栏", "为导航区单独布景"],
          ].map(([title, description], index) => (
            <div
              className="annotation border-line relative flex items-start gap-3 border-b px-5 py-4 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
              key={title}
            >
              <span className="bg-brand mt-2 block h-px w-8 shrink-0" aria-hidden="true"></span>
              <span>
                <strong className="block text-sm font-semibold text-ink">{title}</strong>
                <small className="text-muted mt-1 block text-xs leading-5">{description}</small>
              </span>
              <span className="bg-brand absolute top-0 left-9 h-4 w-px" aria-hidden="true"></span>
              <span className="sr-only">图层 {index + 1}</span>
            </div>
          ))}
        </figcaption>
      </figure>
    </section>
  )
}

type LayerKind = "wallpaper" | "main" | "sidebar"

const layers: Array<{ title: string; description: string; kind: LayerKind }> = [
  {
    title: "全局壁纸",
    description: "控制整个内容区的底色、图片、透明度与柔化。",
    kind: "wallpaper",
  },
  {
    title: "主面板",
    description: "把人物或装饰放进工作区，不遮挡 Codex 的核心操作。",
    kind: "main",
  },
  {
    title: "侧边栏",
    description: "独立设置导航区域，让主题在层次上保持清晰。",
    kind: "sidebar",
  },
]

function LayerDiagram({ kind }: { kind: LayerKind }) {
  return (
    <svg
      aria-hidden="true"
      className="h-24 w-full max-w-60 text-ink"
      fill="none"
      viewBox="0 0 240 96"
      stroke="currentColor"
      strokeWidth="1"
    >
      <rect x="8" y="8" width="224" height="80" rx="3" className="stroke-line fill-white" />
      <path d="M8 20h224" className="stroke-line" />
      <circle cx="16" cy="14" r="1.5" className="fill-brand stroke-none" />
      <circle cx="22" cy="14" r="1.5" className="fill-signal stroke-none" />
      {kind === "wallpaper" && (
        <rect x="16" y="28" width="208" height="52" className="fill-mint-soft stroke-brand/40" />
      )}
      {kind === "main" && (
        <>
          <path d="M52 20v68" className="stroke-line" />
          <rect x="68" y="32" width="138" height="44" className="fill-mint-soft stroke-brand" />
        </>
      )}
      {kind === "sidebar" && (
        <>
          <rect x="8" y="20" width="52" height="68" className="fill-mint-soft stroke-brand" />
          <path d="M60 20v68" className="stroke-brand" />
        </>
      )}
    </svg>
  )
}

function Layers() {
  return (
    <section id="layers" className="border-line border-y bg-white">
      <div className="mx-auto w-[min(calc(100%_-_2rem),80rem)] py-20 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="max-w-[15ch] text-[clamp(2rem,3.2vw,3rem)] leading-tight font-medium tracking-[-0.03em] text-ink lg:col-span-7">
            三个图层，一条清晰的应用链路
          </h2>
          <p className="text-muted max-w-[34rem] text-base leading-7 lg:col-span-5">
            每一层单独选择图片、位置、大小、透明度、柔化与焦点。保存以后，由同一套 Core
            将配置持续应用到 Codex。
          </p>
        </div>

        <div className="border-line mt-10 border">
          <div className="divide-line divide-y">
            {layers.map((layer) => (
              <article
                className="grid grid-cols-[2rem_1fr] items-center gap-x-4 gap-y-5 p-5 sm:grid-cols-[2rem_9rem_1fr_15rem] sm:gap-6 sm:px-7 sm:py-4"
                key={layer.title}
              >
                <span className="bg-brand grid size-6 place-items-center rounded-full text-xs font-semibold text-white">
                  {layers.indexOf(layer) + 1}
                </span>
                <h3 className="text-base font-semibold tracking-[-0.02em] text-ink">
                  {layer.title}
                </h3>
                <p className="text-muted col-span-2 text-sm leading-6 sm:col-span-1">
                  {layer.description}
                </p>
                <div className="border-line col-span-2 flex justify-center border-t pt-4 sm:col-span-1 sm:border-t-0 sm:pt-0">
                  <LayerDiagram kind={layer.kind} />
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="text-brand mt-6 flex items-center gap-3 text-sm">
          <span className="bg-brand block h-px w-12" aria-hidden="true"></span>
          保存后同步到当前与新打开的窗口
        </div>
      </div>
    </section>
  )
}

function SettingsProof() {
  return (
    <section id="settings" className="mx-auto w-[min(calc(100%_-_2rem),80rem)] py-20 lg:py-28">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h2 className="max-w-[13ch] text-[clamp(2rem,3.2vw,3rem)] leading-tight font-medium tracking-[-0.03em] text-ink">
            看得见的设置，也看得见结果
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="text-muted max-w-[34rem] text-base leading-7">
            预览区与设置区并排。换图、拖动、缩放或调整透明度时，不需要反复猜参数。
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-ink sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {["自定义图片", "拖拽定位", "浅色 / 深色预览", "本机保存"].map((item) => (
              <li className="flex items-center gap-2" key={item}>
                <span className="bg-brand size-1.5 rounded-full" aria-hidden="true"></span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <figure className="border-line mt-12 border bg-white p-1.5 sm:p-2.5">
        <img
          className="aspect-[2472/1544] w-full object-cover"
          src={settingsPreviewUrl}
          alt="Codex Skin 设置页：左侧为实时预览，右侧为三个图层的设置面板"
          width="2472"
          height="1544"
          loading="lazy"
        />
        <figcaption className="border-line text-muted flex flex-col gap-2 border-t px-4 py-4 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between">
          <span>可视化设置页 · 实际界面</span>
          <span>全局背景 / 主面板 / 侧边栏</span>
        </figcaption>
      </figure>
    </section>
  )
}

const gallery = [
  {
    src: darkThemePreviewUrl,
    alt: "Codex Skin 深色主题实际效果",
    title: "深色主题",
    detail: "透明界面与暗色背景",
  },
  {
    src: animeThemePreviewUrl,
    alt: "Codex Skin 动漫人物主题实际效果",
    title: "人物布景",
    detail: "主面板与侧边栏独立组合",
  },
  {
    src: wallpaperThemePreviewUrl,
    alt: "Codex Skin 自定义壁纸实际效果",
    title: "自定义壁纸",
    detail: "使用留在本机的图片",
  },
]

function Gallery() {
  return (
    <section className="border-line bg-mint-soft border-y">
      <div className="mx-auto w-[min(calc(100%_-_2rem),80rem)] py-20 lg:py-28">
        <div className="border-line grid gap-6 border-b pb-9 lg:grid-cols-12 lg:items-end">
          <h2 className="text-[clamp(2rem,3.2vw,3rem)] leading-tight font-medium tracking-[-0.03em] text-ink lg:col-span-7">
            同一个 Codex，
            <br />
            可以有不同的工作气氛
          </h2>
          <p className="text-muted max-w-[34rem] text-base leading-7 lg:col-span-5">
            保留 Codex 原本的信息层级，再把背景、人物和侧边栏组合成你习惯的空间。
          </p>
        </div>

        <div className="grid gap-10 pt-10 lg:grid-cols-2">
          {gallery.map((item, index) => (
            <figure className={index === 0 ? "lg:col-span-2" : ""} key={item.title}>
              <div className="border-line overflow-hidden border bg-white p-1.5 sm:p-2">
                <img
                  className="aspect-[1800/1118] w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.01]"
                  src={item.src}
                  alt={item.alt}
                  width="1800"
                  height="1118"
                  loading="lazy"
                />
              </div>
              <figcaption className="border-line mt-4 flex items-start justify-between gap-6 border-t pt-4">
                <strong className="text-sm font-semibold text-ink">{item.title}</strong>
                <span className="text-muted max-w-[18rem] text-right text-xs leading-5">
                  {item.detail}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

const boundaries = [
  ["不修改应用包", "不改 app.asar、应用签名、登录数据或更新程序。"],
  ["只连接本机", "通过仅回环可访问的调试连接，为正在运行的 Codex 窗口应用样式。"],
  ["图片留在本机", "配置和用户选择的图片保存在本地，不依赖在线账户。"],
]

function Boundaries() {
  return (
    <section
      id="safety"
      className="mx-auto grid w-[min(calc(100%_-_2rem),80rem)] gap-12 py-20 lg:grid-cols-12 lg:py-28"
    >
      <div className="lg:col-span-5">
        <h2 className="max-w-[13ch] text-[clamp(2rem,3.2vw,3rem)] leading-tight font-medium tracking-[-0.03em] text-ink">
          安全边界和视觉效果一样重要
        </h2>
      </div>
      <dl className="border-line border-y lg:col-span-7">
        {boundaries.map(([term, description]) => (
          <div
            className="border-line grid gap-3 border-b py-7 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:gap-8"
            key={term}
          >
            <dt className="font-semibold text-ink">{term}</dt>
            <dd className="text-muted text-sm leading-6">{description}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ReleaseChannels() {
  return (
    <section id="release" className="border-line bg-mint-soft border-y text-ink">
      <div className="mx-auto w-[min(calc(100%_-_2rem),80rem)] py-20 lg:py-24">
        <div className="border-line grid gap-8 border-b pb-10 lg:grid-cols-12 lg:items-end">
          <h2 className="text-[clamp(2rem,3.2vw,3rem)] leading-tight font-medium tracking-[-0.03em] lg:col-span-7">
            两条发布通道，
            <br />
            面向不同的人
          </h2>
          <p className="text-muted max-w-[34rem] text-base leading-7 lg:col-span-5">
            普通用户使用 macOS 客户端；npm CLI 保留给开发、自动化、诊断与故障恢复。
          </p>
        </div>

        <div className="border-line mt-10 grid border bg-white lg:grid-cols-2">
          <article className="border-line border-b p-7 sm:p-9 lg:border-r lg:border-b-0">
            <div className="flex items-center justify-between gap-6">
              <img src={iconUrl} alt="" className="size-12" width="48" height="48" />
              <div className="text-muted flex items-center gap-2 text-sm">
                <span className="bg-signal size-2 rounded-full" aria-hidden="true"></span>
                预览版已发布
              </div>
            </div>
            <h3 className="mt-8 text-2xl font-medium tracking-[-0.025em]">macOS 客户端</h3>
            <p className="text-muted mt-4 max-w-[30rem] text-sm leading-6">
              面向普通用户的主产品。当前提供 Apple Silicon 开发预览；正式签名与公证仍在补齐。
            </p>
            <a
              className="bg-brand hover:bg-brand-strong mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition-colors"
              href={desktopDmgUrl}
            >
              <ArrowDown className="size-4" />
              下载 macOS 预览版
            </a>
          </article>

          <article className="p-7 sm:p-9">
            <div className="flex items-center justify-between gap-6">
              <span className="border-line grid size-12 place-items-center rounded-lg border bg-canvas font-mono text-lg">
                &gt;_
              </span>
              <p className="text-muted text-right text-sm">按 Core / CLI 变化独立发布</p>
            </div>
            <h3 className="mt-8 text-2xl font-medium tracking-[-0.025em]">npm CLI</h3>
            <p className="text-muted mt-4 max-w-[30rem] text-sm leading-6">
              面向开发与支持场景。仅桌面界面变化时，不需要跟随客户端同步发布 npm 版本。
            </p>
            <a
              className="group border-brand text-brand hover:bg-brand mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:text-white"
              href={npmUrl}
              target="_blank"
              rel="noreferrer"
            >
              查看 npm 包
              <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </article>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-line border-t bg-white">
      <div className="mx-auto flex w-[min(calc(100%_-_2rem),80rem)] flex-col gap-8 py-8 sm:flex-row sm:items-center sm:justify-between">
        <Brand compact />
        <p className="text-muted text-xs leading-5">为 macOS Codex 准备的本地主题工具。</p>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-ink">
          <a className="nav-link" href={githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="nav-link" href={npmUrl} target="_blank" rel="noreferrer">
            npm
          </a>
          <a
            className="nav-link"
            href={`${githubUrl}/blob/main/LICENSE`}
            target="_blank"
            rel="noreferrer"
          >
            MIT License
          </a>
        </div>
      </div>
    </footer>
  )
}

function App() {
  return (
    <div id="top" className="min-h-screen bg-canvas text-ink">
      <Header />
      <main>
        <InstallHero />
        <SourceBuild />
        <ProductProof />
        <SettingsProof />
        <Layers />
        <Gallery />
        <Boundaries />
        <ReleaseChannels />
      </main>
      <Footer />
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
