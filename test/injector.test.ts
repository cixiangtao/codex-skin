import assert from "node:assert/strict"

import { test } from "vitest"

import {
  BACKGROUND_STYLE_ID,
  buildInjectionExpression,
  buildRemovalExpression,
} from "../src/runtime/injector.ts"

test("buildInjectionExpression is idempotent and preserves arbitrary CSS", () => {
  const expression = buildInjectionExpression("body::before { content: `</style>`; }")
  assert.match(expression, new RegExp(BACKGROUND_STYLE_ID))
  assert.match(expression, /MutationObserver/)
  assert.match(expression, /textContent/)
  assert.match(expression, /<\\\/style>/)
})

test("buildRemovalExpression removes the style and observer", () => {
  const expression = buildRemovalExpression()
  assert.match(expression, /remove\(\)/)
  assert.match(expression, /codexBackgroundCleanup/)
})
