# Contributing to ZFontManager

Thank you for wanting to help. This document exists so that a pull request is
a pleasure to merge rather than a week of repair work, and so you know up front
what will be checked.

Not a coder? Translations are the easiest and most valuable way in — see
[TRANSLATING.md](docs/TRANSLATING.md). Bug reports and feature ideas are
welcome as issues, always.

---

## The one rule that matters most

**ZFontManager runs on Linux, Windows and macOS. Everything you contribute has
to work on all three.**

This is not a nice-to-have. It is the whole promise of the project: one font
manager, same behaviour, three platforms. A feature that only works on the
platform you happen to develop on is not finished — it is a bug that has not
been noticed yet, and it lands on the maintainer to find and fix.

Before you open a pull request, ask yourself, for every single thing you added:

- Does this work on Linux?
- Does this work on Windows?
- Does this work on macOS?

If the answer to all three is yes, say so in the pull request description, and
say how you know — tested it, or reasoned about it and want it checked.

### When something genuinely cannot work everywhere

Sometimes it really can't. Affinity by Canva has no Linux build. The Photoshop
integration needs COM on Windows and AppleScript on macOS. That is fine and
expected. What is **not** fine is letting it fail silently on the platforms it
does not support.

When a feature is platform-bound, all of the following are required:

1. **Say so in the pull request**, in plain words, near the top. Name the
   platforms it works on and the platforms it does not, and why.
2. **Gate the code** so the unsupported platform never runs it. No background
   threads polling for something that cannot exist, no timeouts ticking away
   for a program that was never installed.
3. **Hide the interface** on platforms where the feature is unavailable. A
   toggle a user can switch on that then does nothing is worse than no toggle.
   The codebase already does this with `navigator.platform` — follow the
   existing pattern.
4. **Write it down** in `README.md` under *Platform notes*, so users are not
   left guessing why a menu item is missing.

If part of a feature works everywhere and part of it doesn't, split it. The
cross-platform half can merge immediately.

### Watch for the quiet cases

The obvious platform bugs get caught. These are the ones that slip through:

- **Paths.** Never hardcode `\` or `/` or a drive letter. Use `PathBuf::join`,
  and `dirs::` for locations. Remember Linux paths are case-sensitive and
  Windows paths are not.
- **Process and file names.** An executable is `thing.exe` on Windows and
  `thing` elsewhere — and possibly `thing.real` inside a wrapper.
- **Font visibility.** Registering a font is completely different on each
  platform: the registry on Windows, fontconfig on Linux, the font folder on
  macOS. A file sitting in an arbitrary folder is visible to other applications
  on Windows and invisible on Linux and macOS.
- **Cleanup paths.** If you register, unregister. If you link, unlink. Check
  that the *removal* path is implemented on every platform, not just the one
  where you tested adding.
- **Cost when switched off.** A feature that is disabled by default should do
  approximately nothing. Enumerating every running process every two seconds
  for a feature nobody enabled is a bug on all three platforms at once.

---

## Interface text must be translated

ZFontManager ships in nine languages. Every one of them is complete, and it
stays that way.

If your change adds, removes or rewords **any** user-visible string:

- Add the key to `src/locales/en.json`, and
- Add it to **all** other files in `src/locales/`.

Then run:

```sh
pnpm i18n:check
```

Every language must report **100%**. Note that the checker exits successfully
even when languages are incomplete — it falls back to English rather than
crashing — so read the output, don't just check the exit code.

Use the plural forms the language actually needs, not the English ones.
Russian needs `_one`, `_few`, `_many` and `_other`; Spanish, French and
Brazilian Portuguese need `_many`; Japanese and both Chinese variants need only
`_other`. `pnpm i18n:check` prints the forms it expects for each language.

If you genuinely cannot translate into a language, say so in the pull request
rather than leaving the keys out. English placeholders that are flagged are far
better than silent gaps nobody notices.

---

## Before you open the pull request

```sh
pnpm install
pnpm i18n:check          # every language at 100%
npx tsc --noEmit         # no type errors
cd src-tauri && cargo check
```

`cargo check` only compiles the platform you run it on. Code inside
`#[cfg(target_os = "...")]` blocks for the *other* two platforms is not
compiled at all, so it can be completely broken and still pass locally. Keep
that in mind before claiming something builds.

Also, please:

- **Keep it reviewable.** One feature per pull request. A branch that changes
  two thousand lines across twenty-five files cannot be reviewed properly by
  anybody, and it will sit unmerged for a long time. Several small pull requests
  get merged much faster than one large one.
- **Don't commit stray files.** No editor config, no personal scripts, no
  temporary files from your design tool, no build output. Check `git status`
  before you push, and check the *Files changed* tab on GitHub after.
- **Don't change project-wide configuration** to suit your local setup —
  `.gitignore`, `.npmrc`, formatter settings and the like. If you think one
  should change, that is its own pull request with its own reasoning.
- **Leave names, URLs and licence headers alone** unless the change is
  specifically about them.

## If you used an AI assistant

That is fine, and you don't need to hide it. Large language models write
plausible code that compiles and is wrong in ways that only show up on a
platform you didn't run.

So: read every line you are about to submit, and be able to explain why it is
there. Test it, on as many of the three platforms as you can reach. If you
generated a lot of code quickly, that is a reason to split it into smaller pull
requests and check it harder, not to send more of it at once.

Unreviewed generated code is the single most expensive kind of contribution to
receive, because the cost of finding what is wrong with it lands entirely on
somebody else.

---

## Reporting bugs

Open an issue with your operating system and version, what you expected, what
happened instead, and steps to reproduce it. If it involves a specific font,
saying which one helps enormously.

---

## Licence

ZFontManager is GPL-3.0-only. By contributing you agree your work is licensed
under the same terms.
