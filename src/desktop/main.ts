import path from "node:path"
import { fileURLToPath } from "node:url"

import { app, BrowserWindow, dialog, Menu, nativeImage, shell } from "electron"

import { createCodexSkinCore } from "../core/index.ts"
import type { CodexSkinCore } from "../core/index.ts"
import { BackgroundStateError } from "../runtime/background-service.ts"
import { readConfig, resolveDataDirectory } from "../runtime/config.ts"
import { listenSettingsServer } from "../runtime/settings-server.ts"
import { createDesktopBackgroundLifecycle } from "./background-lifecycle.ts"

type SettingsServer = Awaited<ReturnType<typeof listenSettingsServer>>

const APPLICATION_NAME = "Codex Skin"

app.setName(APPLICATION_NAME)
const hasSingleInstanceLock = app.requestSingleInstanceLock()
const dataDirectory = resolveDataDirectory()
let core: CodexSkinCore | undefined
let mainWindow: BrowserWindow | undefined
let readyToQuit = false
let settingsServer: SettingsServer | undefined
let shutdownTask: Promise<void> | undefined

function uiRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "ui")
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist/ui")
}

function installDevelopmentDockIcon() {
  if (app.isPackaged || process.platform !== "darwin") return
  const iconPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../apps/desktop/build/icon.png",
  )
  const icon = nativeImage.createFromPath(iconPath)
  if (!icon.isEmpty()) app.dock.setIcon(icon)
}

function showMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function installApplicationMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: APPLICATION_NAME,
        submenu: [
          { label: "打开设置", accelerator: "CommandOrControl+,", click: showMainWindow },
          { type: "separator" },
          { role: "hide", label: "隐藏 Codex Skin" },
          { role: "hideOthers", label: "隐藏其他应用" },
          { role: "unhide", label: "全部显示" },
          { type: "separator" },
          { role: "quit", label: "退出 Codex Skin" },
        ],
      },
      {
        label: "编辑",
        submenu: [
          { role: "undo", label: "撤销" },
          { role: "redo", label: "重做" },
          { type: "separator" },
          { role: "cut", label: "剪切" },
          { role: "copy", label: "复制" },
          { role: "paste", label: "粘贴" },
          { role: "selectAll", label: "全选" },
        ],
      },
      {
        label: "窗口",
        submenu: [
          { role: "minimize", label: "最小化" },
          { role: "zoom", label: "缩放" },
          { type: "separator" },
          { role: "front", label: "前置全部窗口" },
        ],
      },
    ]),
  )
}

async function createMainWindow(server: SettingsServer) {
  const allowedOrigin = new URL(server.url).origin
  const window = new BrowserWindow({
    backgroundColor: "#f2f0e8",
    height: 820,
    minHeight: 680,
    minWidth: 960,
    show: false,
    title: APPLICATION_NAME,
    width: 1180,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow = window

  window.on("close", (event) => {
    if (readyToQuit) return
    event.preventDefault()
    window.hide()
  })
  window.on("ready-to-show", () => window.show())
  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (new URL(navigationUrl).origin === allowedOrigin) return
    event.preventDefault()
  })
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url)
    return { action: "deny" }
  })

  await window.loadURL(server.url)
}

async function startBackgroundOnLaunch(activeCore: CodexSkinCore) {
  try {
    await activeCore.start(await readConfig({ dataDirectory }))
  } catch (error) {
    if (error instanceof BackgroundStateError && error.code === "RESTART_REQUIRED") return
    console.error("Unable to start Codex Skin:", error)
    await dialog.showMessageBox({
      buttons: ["好"],
      detail: error instanceof Error ? error.message : String(error),
      message: "Codex Skin 暂时无法启动背景服务",
      type: "warning",
    })
  }
}

async function closeSettingsServer(server: SettingsServer) {
  if (!server.server.listening) return
  await new Promise<void>((resolve) => {
    server.server.close(() => resolve())
    server.server.closeAllConnections()
  })
}

async function shutdown() {
  if (shutdownTask) return await shutdownTask
  shutdownTask = (async () => {
    try {
      if (core) {
        const config = await readConfig({ dataDirectory })
        await core.sync({ ...config, enabled: false })
      }
    } catch (error) {
      console.error("Unable to stop the Codex Skin background:", error)
    }
    if (settingsServer) await closeSettingsServer(settingsServer)
  })()
  return await shutdownTask
}

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on("second-instance", showMainWindow)
  app.on("activate", showMainWindow)
  app.on("before-quit", (event) => {
    if (readyToQuit) return
    event.preventDefault()
    void shutdown().finally(() => {
      readyToQuit = true
      app.quit()
    })
  })

  void app
    .whenReady()
    .then(async () => {
      installDevelopmentDockIcon()
      installApplicationMenu()
      const lifecycle = createDesktopBackgroundLifecycle({
        dataDirectory,
        onError: (error) => console.error("Codex Skin background monitor stopped:", error),
      })
      core = createCodexSkinCore({ backgroundLifecycle: lifecycle, dataDirectory })
      settingsServer = await listenSettingsServer({
        core,
        dataDirectory,
        idleTimeoutMs: null,
        uiRoot: uiRoot(),
      })
      await createMainWindow(settingsServer)
      if (process.env.CODEX_SKIN_SKIP_AUTO_START !== "1") void startBackgroundOnLaunch(core)
    })
    .catch((error) => {
      console.error("Unable to open Codex Skin:", error)
      dialog.showErrorBox(
        "Codex Skin 无法打开",
        error instanceof Error ? error.message : String(error),
      )
      readyToQuit = true
      app.quit()
    })
}
