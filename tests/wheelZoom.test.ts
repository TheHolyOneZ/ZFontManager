import { test } from "node:test";
import assert from "node:assert/strict";
import { stepIndex, wheelPixels, wheelStep, type WheelState } from "../src/lib/wheelZoom.ts";

test("one mouse wheel notch is one size step, up makes it bigger", () => {
  const s: WheelState = { acc: 0, at: 0 };
  assert.equal(wheelStep(s, -100, 10), 1);
  assert.equal(wheelStep(s, -100, 20), 1);
  assert.equal(wheelStep(s, 100, 30), -1);
});

test("line-based wheels count the same as pixel wheels", () => {
  const s: WheelState = { acc: 0, at: 0 };
  assert.equal(wheelPixels(-3, 1), -48);
  assert.equal(wheelStep(s, wheelPixels(-3, 1), 5), 1);
  assert.equal(wheelPixels(1, 2), 400);
});

test("small trackpad and pinch deltas add up before a step", () => {
  const s: WheelState = { acc: 0, at: 0 };
  assert.equal(wheelStep(s, -8, 1), 0);
  assert.equal(wheelStep(s, -8, 2), 0);
  assert.equal(wheelStep(s, -8, 3), 0);
  assert.equal(wheelStep(s, -8, 4), 0);
  assert.equal(wheelStep(s, -8, 5), 1);
  assert.equal(s.acc, 0);
});

test("changing direction or pausing starts counting again", () => {
  const s: WheelState = { acc: 0, at: 0 };
  assert.equal(wheelStep(s, -30, 1), 0);
  assert.equal(wheelStep(s, 30, 2), 0);
  assert.equal(s.acc, 30);
  assert.equal(wheelStep(s, 30, 1000), 0);
  assert.equal(s.acc, 30);
});

test("the size stays inside the slider range", () => {
  assert.equal(stepIndex(7, 1, 8), 7);
  assert.equal(stepIndex(0, -1, 8), 0);
  assert.equal(stepIndex(3, 1, 8), 4);
});
