import assert from "node:assert/strict"

import { test } from "vitest"

import { anchoredBackgroundPosition, axisAnchor } from "../src/shared/background-position.ts"
import {
  backgroundPositionFromDrag,
  backgroundSurfaceIsEnabled,
  defaultConfig,
  setAllBackgroundsEnabled,
} from "../src/ui/model.ts"

test("setAllBackgroundsEnabled synchronizes the master and both surface switches", () => {
  const disabled = setAllBackgroundsEnabled(
    {
      ...defaultConfig,
      enabled: true,
      surfaces: {
        main: { ...defaultConfig.surfaces.main, enabled: true },
        sidebar: { ...defaultConfig.surfaces.sidebar, enabled: true },
      },
    },
    false,
  )

  assert.equal(disabled.enabled, false)
  assert.equal(disabled.surfaces.main.enabled, false)
  assert.equal(disabled.surfaces.sidebar.enabled, false)

  const enabled = setAllBackgroundsEnabled(disabled, true)
  assert.equal(enabled.enabled, true)
  assert.equal(enabled.surfaces.main.enabled, true)
  assert.equal(enabled.surfaces.sidebar.enabled, true)
})

test("backgroundSurfaceIsEnabled applies the global switch to every surface", () => {
  const config = {
    ...defaultConfig,
    enabled: false,
    surfaces: {
      main: { ...defaultConfig.surfaces.main, enabled: true },
      sidebar: { ...defaultConfig.surfaces.sidebar, enabled: true },
    },
  }

  assert.equal(backgroundSurfaceIsEnabled(config, "main"), false)
  assert.equal(backgroundSurfaceIsEnabled(config, "sidebar"), false)
})

test("backgroundSurfaceIsEnabled preserves each surface switch when globally enabled", () => {
  const config = {
    ...defaultConfig,
    enabled: true,
    surfaces: {
      main: { ...defaultConfig.surfaces.main, enabled: true },
      sidebar: { ...defaultConfig.surfaces.sidebar, enabled: false },
    },
  }

  assert.equal(backgroundSurfaceIsEnabled(config, "main"), true)
  assert.equal(backgroundSurfaceIsEnabled(config, "sidebar"), false)
})

test("backgroundPositionFromDrag follows the pointer when the illustration is smaller", () => {
  assert.equal(
    backgroundPositionFromDrag({
      illustrationLength: 300,
      initialPosition: 20,
      pointerDelta: 60,
      stageLength: 600,
    }),
    40,
  )
})

test("backgroundPositionFromDrag reverses percentages for an oversized illustration", () => {
  assert.equal(
    backgroundPositionFromDrag({
      illustrationLength: 520,
      initialPosition: 50,
      pointerDelta: 10,
      stageLength: 480,
    }),
    25,
  )
})

test("backgroundPositionFromDrag clamps the persisted background position", () => {
  assert.equal(
    backgroundPositionFromDrag({
      illustrationLength: 300,
      initialPosition: 90,
      pointerDelta: 100,
      stageLength: 600,
    }),
    100,
  )
  assert.equal(
    backgroundPositionFromDrag({
      illustrationLength: 520,
      initialPosition: 10,
      pointerDelta: 100,
      stageLength: 480,
    }),
    0,
  )
})

test("backgroundPositionFromDrag keeps its position when the image cannot travel", () => {
  assert.equal(
    backgroundPositionFromDrag({
      illustrationLength: 480.25,
      initialPosition: 72,
      pointerDelta: 100,
      stageLength: 480,
    }),
    72,
  )
})

test("axisAnchor selects the nearest edge around the center point", () => {
  assert.deepEqual(axisAnchor(20), { edge: "start", offset: 20 })
  assert.deepEqual(axisAnchor(50), { edge: "center", offset: 0 })
  assert.deepEqual(axisAnchor(82), { edge: "end", offset: 18 })
})

test("anchoredBackgroundPosition emits explicit edge-relative percentages", () => {
  assert.equal(anchoredBackgroundPosition(20, 20), "left 20% top 20%")
  assert.equal(anchoredBackgroundPosition(50, 50), "center center")
  assert.equal(anchoredBackgroundPosition(82, 80), "right 18% bottom 20%")
})
