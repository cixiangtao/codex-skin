import assert from "node:assert/strict"

import { afterEach, test, vi } from "vitest"

import { createMenuBarIconController } from "../src/desktop/menu-bar-icon.ts"
import { MENU_BAR_ICON_IDS, MENU_BAR_ICONS } from "../src/shared/menu-bar-icons.ts"

afterEach(() => vi.useRealTimers())

test("built-in menu bar icons provide valid static and animated PNG frames", () => {
  assert.deepEqual(MENU_BAR_ICON_IDS, ["classic", "pixel-cat", "pixel-ghost"])
  assert.equal(MENU_BAR_ICONS.classic.frames.length, 1)
  assert.equal(MENU_BAR_ICONS["pixel-cat"].frames.length, 4)
  assert.equal(MENU_BAR_ICONS["pixel-ghost"].frames.length, 4)

  for (const iconId of MENU_BAR_ICON_IDS) {
    for (const frame of MENU_BAR_ICONS[iconId].frames) {
      assert.match(frame, /^data:image\/png;base64,iVBOR/)
    }
  }
})

test("menu bar icon controller animates frames, switches styles, and cleans up", () => {
  vi.useFakeTimers()
  const images: Array<{ dataUrl: string; template: boolean }> = []
  const contextMenus: unknown[] = []
  const trayImages: Array<{ dataUrl: string; template: boolean }> = []
  const listeners = new Map<string, () => void>()
  let destroyed = false
  let opens = 0

  const tray = {
    destroy: () => {
      destroyed = true
    },
    isDestroyed: () => destroyed,
    on: (event: string, listener: () => void) => {
      listeners.set(event, listener)
      return tray
    },
    setContextMenu: (contextMenu: unknown) => {
      contextMenus.push(contextMenu)
    },
    setImage: (image: { dataUrl: string; template: boolean }) => {
      trayImages.push(image)
    },
    setToolTip: () => undefined,
  }

  const controller = createMenuBarIconController({
    contextMenu: {} as never,
    createImage: (dataUrl) => {
      const image = {
        dataUrl,
        isEmpty: () => false,
        template: false,
        setTemplateImage: (template: boolean) => {
          image.template = template
        },
      }
      images.push(image)
      return image as never
    },
    createTray: () => tray as never,
    onClick: () => {
      opens += 1
    },
  })

  controller.apply("pixel-cat")
  assert.equal(trayImages.length, 1)
  assert.equal(trayImages[0]?.template, true)
  vi.advanceTimersByTime(MENU_BAR_ICONS["pixel-cat"].frameDurationMs * 2)
  assert.equal(trayImages.length, 3)
  assert.notEqual(trayImages[0]?.dataUrl, trayImages[1]?.dataUrl)

  listeners.get("click")?.()
  assert.equal(opens, 1)

  controller.apply("classic")
  const imageCountAfterSwitch = trayImages.length
  vi.advanceTimersByTime(2000)
  assert.equal(trayImages.length, imageCountAfterSwitch)

  const updatedContextMenu = { id: "updated" }
  controller.setContextMenu(updatedContextMenu as never)
  assert.equal(contextMenus.at(-1), updatedContextMenu)

  controller.destroy()
  assert.equal(destroyed, true)
  assert.ok(images.length >= 4)
})
