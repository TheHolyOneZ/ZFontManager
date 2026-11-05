import { test } from "node:test";
import assert from "node:assert/strict";
import { QUICK_FADE, panelExit, setQuickMotion, spring, springSoft, staggerDelay } from "../src/design/springs.ts";

test("reduced motion turns every spring into a quick fade and back", () => {
  const before = { ...springSoft };
  setQuickMotion(true);
  assert.deepEqual({ ...springSoft }, QUICK_FADE);
  assert.deepEqual({ ...spring }, QUICK_FADE);
  assert.deepEqual({ ...panelExit }, QUICK_FADE);
  assert.equal(staggerDelay(5), 0);
  setQuickMotion(false);
  assert.deepEqual({ ...springSoft }, before);
  assert.ok(staggerDelay(5) > 0);
});

test("closing the panel takes well under the old half second", () => {
  setQuickMotion(false);
  assert.equal(panelExit.type, "tween");
  assert.ok((panelExit.duration ?? 1) <= 0.2);
  assert.ok((QUICK_FADE.duration ?? 1) <= 0.1);
});
