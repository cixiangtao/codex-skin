import assert from "node:assert/strict"
import path from "node:path"

import { test } from "vitest"

import {
  DESKTOP_DEVELOPMENT_API_PORT,
  desktopDevelopmentSettings,
  desktopNavigationOrigins,
} from "../src/desktop/development.ts"

test("desktopDevelopmentSettings configures the renderer redirect and API proxy target", () => {
  const projectRoot = "/tmp/codex-skin"

  assert.deepEqual(desktopDevelopmentSettings("http://127.0.0.1:4178", projectRoot), {
    authenticatedRedirectUrl: "http://127.0.0.1:4178/",
    backgroundsRoot: path.join(projectRoot, "public/backgrounds"),
    port: DESKTOP_DEVELOPMENT_API_PORT,
  })
})

test("desktopDevelopmentSettings leaves packaged runs unchanged", () => {
  assert.equal(desktopDevelopmentSettings(undefined, "/tmp/codex-skin"), undefined)
})

test("desktopDevelopmentSettings rejects a renderer outside the local development host", () => {
  assert.throws(
    () => desktopDevelopmentSettings("https://example.com", "/tmp/codex-skin"),
    /must use http:\/\/127\.0\.0\.1/,
  )
})

test("desktopNavigationOrigins permits settings and development renderer origins", () => {
  assert.deepEqual(
    desktopNavigationOrigins("http://127.0.0.1:4179/?token=secret", "http://127.0.0.1:4178/path"),
    new Set(["http://127.0.0.1:4179", "http://127.0.0.1:4178"]),
  )
})
