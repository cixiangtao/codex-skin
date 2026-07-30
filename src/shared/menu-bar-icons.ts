export const MENU_BAR_ICON_IDS = ["classic", "pixel-cat", "pixel-ghost"] as const

export type MenuBarIconId = (typeof MENU_BAR_ICON_IDS)[number]

export interface MenuBarIconDefinition {
  animated: boolean
  description: string
  frameDurationMs: number
  frames: readonly string[]
  id: MenuBarIconId
  label: string
}

const classicFrames = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAAD1JREFUeNpjYMAFGMEAQwBZEMZGiKFKQmlkIzBMhrCABCMUw5RhF0LSj1uIEcMLmI7A5lQsHsLmbWyBgwoAVXoAfxsiW2cAAAAASUVORK5CYII=",
]

const pixelCatFrames = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAADFJREFUeNpjYKAIMDIiSFxCjAjAgCmI0EWeEBazkK1kQFeG5nwsQmj+YWCECDGSEC4AQ1EAZ/HVU+MAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAACtJREFUeNpjYKAIMDIiSFxCjAiAUEKUEIZGZEEShWCCaM7HIoTmH6yqCAAARbUAav38FE8AAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAADBJREFUeNpjYKAIMDIiSFxCjAjAgCmIWwjIIEoIi/HYbGTAEMAqBLEDXRUDhjK8AABDbQBovBB6QwAAAABJRU5ErkJggg==",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAACtJREFUeNpjYKAIMDIiSBxCjEgAoQRTCEMVsiDlQjBBNOdjEULzD1ZVBAAARgAAasVd1AUAAAAASUVORK5CYII=",
]

const pixelGhostFrames = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAACJJREFUeNpjYKAMMIIBpgiKIKYQIyOGGO2FQAQE4xSiEgAASkQAaUFC0SIAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAACJJREFUeNpjYCABMIIBpgiKIKYQIyOGGO2FQAQE4xSiHQAAUfwAaVBpTDgAAAAASUVORK5CYII=",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAACZJREFUeNpjYKAMMIIBpgiKIKYQIyOGGJgJw/hUkS2ExXh0ISoBAEcqAGXGo85AAAAAAElFTkSuQmCC",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAMAAABhEH5lAAAABlBMVEVMaXEAAACaXKEdAAAAAXRSTlMAQObYZgAAAAlwSFlzAAALEwAACxMBAJqcGAAAACJJREFUeNpjYKA6YAQDTBEUQUwhRkYMMdoLgQgIxilEDgAAQowAaUer+YwAAAAASUVORK5CYII=",
]

export const MENU_BAR_ICONS = Object.freeze({
  classic: {
    animated: false,
    description: "简洁圆点标记",
    frameDurationMs: 0,
    frames: classicFrames,
    id: "classic",
    label: "经典",
  },
  "pixel-cat": {
    animated: true,
    description: "摇尾巡逻中",
    frameDurationMs: 360,
    frames: pixelCatFrames,
    id: "pixel-cat",
    label: "像素猫",
  },
  "pixel-ghost": {
    animated: true,
    description: "上下漂浮",
    frameDurationMs: 420,
    frames: pixelGhostFrames,
    id: "pixel-ghost",
    label: "像素幽灵",
  },
} as const satisfies Record<MenuBarIconId, MenuBarIconDefinition>)

export function isMenuBarIconId(value: unknown): value is MenuBarIconId {
  return typeof value === "string" && MENU_BAR_ICON_IDS.includes(value as MenuBarIconId)
}
