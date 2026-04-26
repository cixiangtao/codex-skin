export type AxisAnchor =
  | { edge: "start"; offset: number }
  | { edge: "center"; offset: 0 }
  | { edge: "end"; offset: number }

/** Splits a 0..100 position around its center and anchors it to the nearest edge. */
export function axisAnchor(position: number): AxisAnchor {
  const normalized = Math.max(0, Math.min(100, position))
  if (normalized < 50) return { edge: "start", offset: normalized }
  if (normalized > 50) return { edge: "end", offset: 100 - normalized }
  return { edge: "center", offset: 0 }
}

function axisPosition(position: number, start: string, end: string) {
  const anchor = axisAnchor(position)
  if (anchor.edge === "center") return "center"
  return `${anchor.edge === "start" ? start : end} ${anchor.offset}%`
}

/** Produces explicit left/right and top/bottom background anchors around the center point. */
export function anchoredBackgroundPosition(x: number, y: number) {
  return `${axisPosition(x, "left", "right")} ${axisPosition(y, "top", "bottom")}`
}
