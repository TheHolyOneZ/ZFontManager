import { test } from "node:test";
import assert from "node:assert/strict";
import { contrast, hexToHsv, hsvToHex, mix, normalizeHex, readableOn } from "../src/lib/color.ts";

test("hex values are normalised to six lowercase digits", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("9D8FF4"), "#9d8ff4");
  assert.equal(normalizeHex(" #9d8ff4 "), "#9d8ff4");
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(normalizeHex("red"), null);
});

test("colors survive a round trip through HSV", () => {
  for (const hex of ["#9d8ff4", "#000000", "#ffffff", "#e8408f", "#0089c4", "#151515"]) {
    assert.equal(hsvToHex(hexToHsv(hex)), hex);
  }
});

test("mixing weights the first color", () => {
  assert.equal(mix("#ffffff", "#000000", 1), "#ffffff");
  assert.equal(mix("#ffffff", "#000000", 0), "#000000");
  assert.equal(mix("#ffffff", "#000000", 0.5), "#808080");
});

test("text on an accent picks whichever of dark or light reads better", () => {
  assert.equal(readableOn("#ffffff"), "#141218");
  assert.equal(readableOn("#161616"), "#ffffff");
  assert.ok(contrast("#000000", "#ffffff") > 20);
});
