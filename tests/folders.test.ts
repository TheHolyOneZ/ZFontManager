import { test } from "node:test";
import assert from "node:assert/strict";
import { folderGroups, folderLabel, inFolder, subfolderOf } from "../src/lib/folders.ts";

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

test("the first folder below the watched folder names the group", () => {
  assert.equal(subfolderOf("/home/me/Fonts/Client A/Lato.ttf", "/home/me/Fonts"), "Client A");
  assert.equal(subfolderOf("/home/me/Fonts/Client A/deep/Lato.ttf", "/home/me/Fonts/"), "Client A");
  assert.equal(subfolderOf("D:\\Fonts\\Brand\\x\\Lato.ttf", "D:\\Fonts"), "Brand");
  assert.equal(subfolderOf("/home/me/Fonts/Lato.ttf", "/home/me/Fonts"), null);
  assert.equal(subfolderOf("/elsewhere/Lato.ttf", "/home/me/Fonts"), null);
});

test("folders turn into collections, whole or per subfolder", () => {
  const families = [
    { name: "Lato", faces: [{ path: "/f/Client A/Lato-Regular.ttf" }, { path: "/f/Client A/Lato-Bold.ttf" }] },
    { name: "Inter", faces: [{ path: "/f/Client B/Inter.ttf" }, { path: "/f/Client A/Inter.ttf" }] },
    { name: "Loose", faces: [{ path: "/f/Loose.ttf" }] },
    { name: "Other", faces: [{ path: "/g/Other.ttf" }] },
  ];
  const whole = folderGroups(families, "/f", false);
  assert.deepEqual([...whole.entries()], [["f", ["Lato", "Inter", "Loose"]]]);
  const split = folderGroups(families, "/f", true);
  assert.deepEqual(Object.fromEntries(split), { "Client A": ["Lato", "Inter"], "Client B": ["Inter"] });
});
