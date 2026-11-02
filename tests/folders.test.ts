import { test } from "node:test";
import assert from "node:assert/strict";
import { folderLabel, inFolder } from "../src/lib/folders.ts";

test("a font belongs to the watched folder it sits in, at any depth", () => {
  assert.ok(inFolder("/home/me/Fonts/Lato.ttf", "/home/me/Fonts"));
  assert.ok(inFolder("/home/me/Fonts/sub/dir/Lato.ttf", "/home/me/Fonts/"));
  assert.ok(inFolder("D:\\Fonts\\Client\\Lato.ttf", "D:\\Fonts"));
  assert.ok(inFolder("D:\\Fonts\\Lato.ttf", "D:\\Fonts\\"));
});

test("a folder whose name only starts the same doesn't match", () => {
  assert.ok(!inFolder("/home/me/Fonts2/Lato.ttf", "/home/me/Fonts"));
  assert.ok(!inFolder("D:\\FontsOld\\Lato.ttf", "D:\\Fonts"));
  assert.ok(!inFolder("/home/me/Fonts", "/home/me/Fonts"));
});

test("folder labels are the last path segment", () => {
  assert.equal(folderLabel("/home/me/Fonts/Client A/"), "Client A");
  assert.equal(folderLabel("D:\\Fonts\\English"), "English");
  assert.equal(folderLabel("C:\\"), "C:");
});
