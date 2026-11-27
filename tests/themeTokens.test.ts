import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APPEARANCE,
  deriveTokens,
  parseAppearance,
  PRESETS,
  presetById,
  themeFromJson,
  themeToJson,
  TOKEN_KEYS,
  tokensFor,
} from "../src/lib/themeTokens.ts";

const HEX = /^#[0-9a-f]{6}$/;

test("every preset produces a full set of valid colors", () => {
  for (const preset of PRESETS) {
    const tokens = deriveTokens(preset);
    for (const key of TOKEN_KEYS) assert.match(tokens[key], HEX, `${preset.id}.${key}`);
  }
});

test("presets have unique ids and both bases have a default", () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  assert.equal(presetById("nope", "dark").id, "ink");
  assert.equal(presetById("ink", "light").id, "paper");
});

test("a custom accent drives selection, focus, switches and slider unless they are overridden", () => {
  const ink = presetById("ink", "dark");
  const tokens = deriveTokens(ink, { accent: "#e8408f" });
  for (const key of ["accent", "selection", "focus", "toggleOn", "slider"] as const) {
    assert.equal(tokens[key], "#e8408f");
  }
  const pinned = deriveTokens(ink, { accent: "#e8408f", tokens: { toggleOn: "#00ff00" } });
  assert.equal(pinned.toggleOn, "#00ff00");
  assert.equal(pinned.focus, "#e8408f");
});

test("broken saved appearance falls back to defaults", () => {
  assert.deepEqual(parseAppearance(null), DEFAULT_APPEARANCE);
  const parsed = parseAppearance({
    darkPreset: "missing",
    lightPreset: "riso",
    radius: 99,
    editor: "weird",
    font: "",
    custom: { ink: { accent: "zzz", tokens: { canvas: "#ABC", bogus: "#fff" } }, nope: { accent: "#fff" } },
  });
  assert.equal(parsed.darkPreset, "ink");
  assert.equal(parsed.lightPreset, "riso");
  assert.equal(parsed.radius, 2);
  assert.equal(parsed.editor, "simple");
  assert.equal(parsed.font, null);
  assert.deepEqual(parsed.custom, { ink: { tokens: { canvas: "#aabbcc" } } });
});

test("an exported theme imports back to the same colors", () => {
  const app = { ...DEFAULT_APPEARANCE, darkPreset: "blueprint", custom: { blueprint: { accent: "#ffd166" } } };
  const parsed = themeFromJson(themeToJson(app, "dark"));
  assert.ok(parsed);
  assert.equal(parsed.base, "dark");
  assert.equal(parsed.preset, "blueprint");
  assert.deepEqual(parsed.tokens, tokensFor(app, "dark"));
  assert.equal(themeFromJson("{\"hello\":1}"), null);
  assert.equal(themeFromJson("not json"), null);
});
