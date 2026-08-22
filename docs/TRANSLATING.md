# Translating ZFontManager

Every piece of interface text lives in one JSON file per language under
[`src/locales/`](../src/locales). Adding a language or fixing a single awkward
line is a small pull request — no Rust, no build tooling, no TypeScript.

Thank you for helping. A translation that sounds native is worth far more than
one that is merely correct.

**You do not have to write code to help.** There are two ways in:

1. **Open a pull request** with your language file — the steps below.
2. **Just ask.** Open an issue saying which language you want and it gets added.
   If you would rather check a draft than write one, say so — a native speaker
   reviewing the result is genuinely valuable, and often the part that is missing.

Currently shipping: English, Deutsch, Español, Français, Português (Brasil),
Русский, 日本語, 简体中文, 繁體中文.

---

## Fixing a phrase in an existing language

1. Open the file for your language, e.g. `src/locales/zh-CN.json`.
2. Change the text on the right-hand side of the `:`. Leave the key on the left alone.
3. Open a pull request. That's it.

If you would rather not use git, just open an issue with the key and your
suggested wording — that is genuinely useful and takes two minutes.

## Adding a new language

1. Copy `src/locales/en.json` to `src/locales/<code>.json`, where `<code>` is the
   BCP-47 tag: `it`, `ko`, `tr`, `pl`, `nl`, `uk`, `ar`, …
2. Translate the values. You do **not** have to finish in one go — any key you
   leave in English still works, and the app falls back to English for anything
   missing. A 60 % translation is a perfectly good first PR.
3. Register the language in [`src/lib/i18n.ts`](../src/lib/i18n.ts) — three small edits:

   ```ts
   import it from "../locales/it.json";              // 1. import it

   export type LocaleCode =
     | "en"
     | "de"
     // …
     | "it";                                        // 2. add the code

   export const LOCALES: readonly LocaleInfo[] = [
     // …
     { code: "it", name: "Italiano", english: "Italian" },   // 3. add the entry
   ];

   const DICTS: Record<LocaleCode, Partial<Dict>> = {
     // …
     it,                                            // and its dictionary
   };
   ```

   `name` is the language's own name (the endonym) — it is what appears in the
   language picker, so a French speaker looking for French should see
   `Français`, not `French`.

   If your language has regional variants that should share one file (say `pt-PT`
   falling back to `pt-BR`), add a line to `REGION_HINTS` in the same file.

4. Run `pnpm i18n:check` and fix anything it reports.

## Rules that matter

**Keep `{placeholders}` exactly as they are.** They are replaced with real values
at runtime. You may move them anywhere in the sentence — word order differs
between languages and that is the point — but do not rename or delete them.

```json
"toast.filesCopied_other": "{count} files copied to {dir}"
```

**Keys ending in `_one` / `_other` are plural forms.** English uses `_one` for
exactly 1 and `_other` for everything else — but every language is different, and
you do not have to work it out yourself: `pnpm i18n:check` prints the exact
categories your language needs and lists any you are missing.

- Chinese, Japanese and Korean need only `_other`.
- Russian needs `_one`, `_few` and `_many` (1 файл, 2 файла, 5 файлов).
- Spanish, French and Portuguese need a `_many` form for very large numbers; if
  it never differs in practice, copy `_other` into it.

If a form is missing, the app falls back to that language's `_other` before it
ever falls back to English — so a partial plural set still reads correctly.

**`preview.defaultSample` is font-preview text, not UI text.** It is the sentence
shown *in the fonts themselves*. Most fonts on a typical machine only contain
Latin glyphs, so a non-Latin sample would render as empty boxes for nearly every
font. Use a pangram in your language if it is written in Latin script (French,
Spanish and German all do); otherwise leave the English one, as Russian, Japanese
and both Chinese files do.

**Do not translate:** `ZFontManager`, `TheHolyOneZ`, format names (`OTF`, `TTF`,
`WOFF`, `VAR`), `OpenType`, `PostScript`, or the URLs and domain names in the
About page.

**Keep it short.** Buttons and labels sit in fixed-width UI. If your translation
is much longer than the English, look for a shorter phrasing before assuming the
layout will cope — and if it genuinely cannot be shorter, say so in the PR so the
CSS can be adjusted.

**CJK and other non-Latin scripts:** the interface font stack is set in
[`src/design/tokens.css`](../src/design/tokens.css). There is a base stack plus
per-language overrides (`:root[lang="ja"]`, `:root[lang="zh-TW"]`) so each script
gets the right regional face rather than a near-miss. If your language needs a
different font stack, add one the same way and mention it in the PR.

## Checking your work

```bash
pnpm i18n:check      # coverage, plural categories, unknown keys, placeholder mismatches
pnpm tauri dev       # then pick your language in Settings → Language
```

The language picker lists every registered locale, plus **System**, which follows
the desktop's language automatically.

## Reporting instead of translating

Spotted text that reads strangely, gets cut off, or is still in English? Open an
issue. Include a screenshot if the problem is visual — that is often faster than
describing it, and it is exactly the feedback that turns a translation from
"technically correct" into something that feels native.
