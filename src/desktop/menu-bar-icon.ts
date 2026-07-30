import type { Menu, NativeImage, Tray } from "electron"

import { MENU_BAR_ICONS } from "../shared/menu-bar-icons.ts"
import type { MenuBarIconId } from "../shared/menu-bar-icons.ts"

interface MenuBarIconControllerOptions {
  contextMenu: Menu
  createImage: (dataUrl: string) => NativeImage
  createTray: (image: NativeImage) => Tray
  onClick: () => void
}

export interface MenuBarIconController {
  apply(iconId: MenuBarIconId): void
  destroy(): void
  setContextMenu(contextMenu: Menu): void
}

/** Owns one persistent macOS status item and advances built-in pixel animation frames. */
export function createMenuBarIconController(
  options: MenuBarIconControllerOptions,
): MenuBarIconController {
  let activeIcon: MenuBarIconId | undefined
  let animationTimer: ReturnType<typeof setInterval> | undefined
  let contextMenu = options.contextMenu
  let frameIndex = 0
  let tray: Tray | undefined

  const clearAnimation = () => {
    if (animationTimer) clearInterval(animationTimer)
    animationTimer = undefined
  }

  const imageForFrame = (dataUrl: string) => {
    const image = options.createImage(dataUrl)
    if (image.isEmpty()) throw new Error("Unable to render a menu bar icon frame.")
    image.setTemplateImage(true)
    return image
  }

  const ensureTray = (image: NativeImage) => {
    if (tray && !tray.isDestroyed()) return tray
    tray = options.createTray(image)
    tray.setContextMenu(contextMenu)
    tray.setToolTip("Codex Skin")
    tray.on("click", options.onClick)
    return tray
  }

  return {
    apply: (iconId) => {
      const definition = MENU_BAR_ICONS[iconId]
      if (activeIcon === iconId && tray && !tray.isDestroyed()) return

      clearAnimation()
      activeIcon = iconId
      frameIndex = 0
      const firstFrame = definition.frames[0]
      if (!firstFrame) throw new Error(`Menu bar icon "${iconId}" has no frames.`)
      const firstImage = imageForFrame(firstFrame)
      const activeTray = ensureTray(firstImage)
      activeTray.setImage(firstImage)

      if (!definition.animated) return
      animationTimer = setInterval(() => {
        if (!tray || tray.isDestroyed()) {
          clearAnimation()
          return
        }
        frameIndex = (frameIndex + 1) % definition.frames.length
        tray.setImage(imageForFrame(definition.frames[frameIndex] || firstFrame))
      }, definition.frameDurationMs)
    },
    destroy: () => {
      clearAnimation()
      activeIcon = undefined
      if (tray && !tray.isDestroyed()) tray.destroy()
      tray = undefined
    },
    setContextMenu: (nextContextMenu) => {
      contextMenu = nextContextMenu
      if (tray && !tray.isDestroyed()) tray.setContextMenu(contextMenu)
    },
  }
}
