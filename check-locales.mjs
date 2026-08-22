/**
 * check-locales.mjs
 *
 * Validates every file in src/locales against en.json, which is the source of truth:
 *   - reports keys a locale is missing (they fall back to English at runtime)
 *   - reports keys a locale has that English does not (usually a typo)
 *   - reports {placeholder} mismatches, which WOULD break the UI
 *
 * Plural keys (name_one, name_other, …) are checked per language: each locale only
 * needs the categories its own plural rules can produce, so Japanese needs just
 * _other while Russian needs _one, _few and _many.
 *
 * Usage:
 *   node check-locales.mjs
 *
 * Exit code is 1 only for placeholder mismatches and unknown keys. Missing keys
 * are reported as coverage, not failure — a partial translation is welcome.
 */

import { readFileSync, readdirSync } from "fs";
import { basename, join } from "path";
import { exit } from "process";

const DIR = "src/locales";
const CATEGORIES = ["zero", "one", "two", "few", "many", "other"];

const read = (f) => JSON.parse(readFileSync(join(DIR, f), "utf8"));
const placeholders = (s) =>
  [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

function splitPlural(key) {
  const at = key.lastIndexOf("_");
  if (at < 0) return null;
  const suffix = key.slice(at + 1);
  return CATEGORIES.includes(suffix) ? { base: key.slice(0, at), category: suffix } : null;
}

const en = read("en.json");

const pluralBases = new Set();
const singular = [];
for (const key of Object.keys(en)) {
  const split = splitPlural(key);
  if (split) pluralBases.add(split.base);
  else singular.push(key);
}

let failed = false;

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const locale = basename(file, ".json");
  const dict = read(file);
  const needed = new Intl.PluralRules(locale).resolvedOptions().pluralCategories;

  const missing = singular.filter((k) => !(k in dict));
  for (const base of pluralBases) {
    for (const category of needed) {
      if (!(`${base}_${category}` in dict)) missing.push(`${base}_${category}`);
    }
  }

  const unknown = [];
  const mismatched = [];
  for (const key of Object.keys(dict)) {
    const split = splitPlural(key);
    const known = key in en || (split && pluralBases.has(split.base));
    if (!known) {
      unknown.push(key);
      continue;
    }

    const reference = key in en ? en[key] : (en[`${split.base}_other`] ?? en[`${split.base}_one`]);
    if (reference !== undefined && placeholders(reference) !== placeholders(dict[key])) {
      mismatched.push([key, reference]);
    }
  }

  const total = singular.length + pluralBases.size * needed.length;
  const done = total - missing.length;
  const pct = ((done / total) * 100).toFixed(1);
  console.log(`\n${file} — ${done}/${total} keys (${pct}%)  plurals: ${needed.join(", ")}`);

  if (missing.length) {
    console.log(`  ${missing.length} missing (English is shown instead):`);
    for (const k of missing.slice(0, 20)) console.log(`    - ${k}`);
    if (missing.length > 20) console.log(`    … and ${missing.length - 20} more`);
  }
  if (unknown.length) {
    failed = true;
    console.log(`  ERROR ${unknown.length} key(s) not in en.json — typo?`);
    for (const k of unknown) console.log(`    - ${k}`);
  }
  if (mismatched.length) {
    failed = true;
    console.log(`  ERROR ${mismatched.length} placeholder mismatch(es):`);
    for (const [k, reference] of mismatched) {
      console.log(`    - ${k}`);
      console.log(`        en: ${reference}`);
      console.log(`        ${file}: ${dict[k]}`);
    }
  }
  if (!missing.length && !unknown.length && !mismatched.length) console.log("  complete");
}

console.log(failed ? "\nFAILED" : "\nOK");
exit(failed ? 1 : 0);
