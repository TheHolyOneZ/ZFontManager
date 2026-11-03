import { test } from "node:test";
import assert from "node:assert/strict";
import { bulkToggleTarget, familyActivation, pathsToToggle, styleGroups } from "../src/lib/familyState.ts";
import type { FontFace } from "../src/lib/ipc.ts";
import { TEXT, library, of } from "./fixtures.ts";

test("a family is inactive, partly active or active", () => {
  const faces = of(library(), TEXT);
  assert.deepEqual(familyActivation(faces), { active: false, partial: false, activeCount: 0 });
  faces[0].active = true;
  assert.deepEqual(familyActivation(faces), { active: false, partial: true, activeCount: 1 });
  for (const f of faces) f.active = true;
  assert.deepEqual(familyActivation(faces), { active: true, partial: false, activeCount: 12 });
});

test("an empty family is not active", () => {
  assert.deepEqual(familyActivation([]), { active: false, partial: false, activeCount: 0 });
});

test("activating a partly active family sends only the missing files", () => {
  const faces = of(library(), TEXT);
  const regular = faces.find((f) => f.style === "Regular")!;
  regular.active = true;
  const paths = pathsToToggle(faces, true);
  assert.equal(paths.length, 11);
  assert.ok(!paths.includes(regular.path));
});

test("deactivating sends only the files that are on", () => {
  const faces = of(library(), TEXT);
  const regular = faces.find((f) => f.style === "Regular")!;
  regular.active = true;
  assert.deepEqual(pathsToToggle(faces, false), [regular.path]);
});

test("a collection file with several faces is sent once", () => {
  const faces = of(library(), TEXT).map((f) => ({ ...f, path: "/fonts/family.ttc" }));
  assert.deepEqual(pathsToToggle(faces, true), ["/fonts/family.ttc"]);
});

test("fonts the OS manages are never toggled", () => {
  const faces = of(library(), TEXT).map((f) => ({ ...f, deactivatable: false }));
  assert.deepEqual(pathsToToggle(faces, true), []);
});

const asFormat = (face: FontFace, format: FontFace["format"], installable = true): FontFace => ({
  ...face,
  id: face.id.replace(".otf", `.${format}`),
  path: face.path.replace(".otf", `.${format}`),
  format,
  installable,
  deactivatable: installable,
});

test("formats of the same style are one style, not several", () => {
  const otf = of(library(), TEXT);
  const regular = otf.find((f) => f.style === "Regular")!;
  const faces = [...otf, asFormat(regular, "ttf"), asFormat(regular, "woff2"), asFormat(regular, "woff")];
  const groups = styleGroups(faces);
  assert.equal(groups.length, 12);
  const reg = groups.find((g) => g.style === "Regular")!;
  assert.deepEqual(reg.formats, ["otf", "ttf", "woff2", "woff"]);
  assert.equal(reg.lead.format, "otf");
  assert.equal(groups[0].weight, 200);
});

test("web fonts the system can't install don't make a family partly active", () => {
  const otf = of(library(), TEXT).map((f) => ({ ...f, active: true }));
  const webOnly = asFormat(otf[0], "woff2", false);
  webOnly.active = false;
  const state = familyActivation([...otf, webOnly]);
  assert.deepEqual(state, { active: true, partial: false, activeCount: 12 });
  assert.ok(!pathsToToggle([...otf, webOnly], true).includes(webOnly.path));
});

test("a style that only exists as a web font is marked web only", () => {
  const face = asFormat(of(library(), TEXT)[0], "woff2", false);
  const [group] = styleGroups([face]);
  assert.ok(group.webOnly);
  assert.ok(!group.deactivatable);
  assert.equal(group.lead.format, "woff2");
});

test("an installable copy leads a style before an uninstallable one", () => {
  const face = of(library(), TEXT)[0];
  const [group] = styleGroups([asFormat(face, "woff2", false), asFormat(face, "ttf")]);
  assert.equal(group.lead.format, "ttf");
  assert.ok(!group.webOnly);
});

const state = (active: boolean, partial = false, deactivatable = true) => ({ active, partial, deactivatable });

test("space on a selection turns everything off when any of it is on", () => {
  assert.equal(bulkToggleTarget([state(true), state(false), state(true)]), false);
  assert.equal(bulkToggleTarget([state(false), state(false, true)]), false);
});

test("space on a selection turns everything on when all of it is off", () => {
  assert.equal(bulkToggleTarget([state(false), state(false)]), true);
});

test("fonts the OS manages do not decide what space does", () => {
  assert.equal(bulkToggleTarget([state(true, false, false), state(false)]), true);
  assert.equal(bulkToggleTarget([state(true, false, false)]), null);
  assert.equal(bulkToggleTarget([]), null);
});
