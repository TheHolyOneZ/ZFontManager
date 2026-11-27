import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BROWSE_IDS,
  clampSidebarWidth,
  mergeOrder,
  moveItem,
  normalizeOrder,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "../src/lib/sidebarLayout.ts";

test("a saved order keeps its sequence and gains any rows it doesn't know yet", () => {
  assert.deepEqual(normalizeOrder(["system", "library"], BROWSE_IDS), [
    "system",
    "library",
    "favorites",
    "lastImported",
    "activated",
    "activatedSession",
    "deactivated",
  ]);
});

test("unknown, duplicate and non-string entries in a saved order are dropped", () => {
  assert.deepEqual(normalizeOrder(["tags", "tags", 4, "nope", "folders"], ["collections", "tags", "folders"]), [
    "tags",
    "folders",
    "collections",
  ]);
  assert.deepEqual(normalizeOrder("garbage", ["a", "b"]), ["a", "b"]);
});

test("reordering only the visible rows leaves hidden rows where they were", () => {
  const full = ["a", "b", "c", "d", "e"];
  assert.deepEqual(mergeOrder(full, ["d", "a", "e"]), ["d", "b", "c", "a", "e"]);
});

test("moving an item shifts the ones in between", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b"], 1, 1), ["a", "b"]);
});

test("the sidebar width stays inside its limits", () => {
  assert.equal(clampSidebarWidth(10), SIDEBAR_MIN_WIDTH);
  assert.equal(clampSidebarWidth(9999), SIDEBAR_MAX_WIDTH);
  assert.equal(clampSidebarWidth(300.6), 301);
});
