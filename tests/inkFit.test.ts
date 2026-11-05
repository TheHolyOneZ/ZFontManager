import { test } from "node:test";
import assert from "node:assert/strict";
import { inkOverflow } from "../src/lib/inkFit.ts";

const metrics = (over: Partial<Parameters<typeof inkOverflow>[0]>) => ({
  width: 100,
  actualBoundingBoxAscent: 18,
  actualBoundingBoxDescent: 4,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: 100,
  fontBoundingBoxAscent: 19,
  fontBoundingBoxDescent: 5,
  ...over,
});

test("ordinary text needs no extra room", () => {
  assert.deepEqual(inkOverflow(metrics({}), 24, 1.15), { top: 0, right: 0, bottom: 0, left: 0 });
});

test("glyphs taller than the line get room above and below", () => {
  const pad = inkOverflow(metrics({ actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 20 }), 24, 1.15);
  assert.ok(pad.top >= 20);
  assert.ok(pad.bottom >= 14);
  assert.equal(pad.left, 0);
});

test("swashes past the start and end of the text get room on the sides", () => {
  const pad = inkOverflow(metrics({ actualBoundingBoxLeft: 7.2, actualBoundingBoxRight: 109 }), 24, 1.15);
  assert.equal(pad.left, 8);
  assert.equal(pad.right, 9);
});

test("older engines without font metrics still get a sensible answer", () => {
  const pad = inkOverflow(
    metrics({
      fontBoundingBoxAscent: undefined,
      fontBoundingBoxDescent: undefined,
      actualBoundingBoxAscent: 40,
    }),
    24,
    1.15,
  );
  assert.ok(pad.top > 0);
});
