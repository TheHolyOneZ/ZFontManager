# Changelog

All notable changes to ZFontManager are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.4.0] — 2026-09-16

### Added

- **Import modes.** Dropping fonts in now offers *Add to library* (the file
  stays where it is and is registered from there) or *Copy to system folder*
  (copied into the library folder, original removed). On Linux and macOS a
  linked font is linked into the font folder so the rest of the system can see
  it — the original is never moved or deleted.
- **Custom library folder** under Settings, for deciding where copied imports
  are stored.
- **Auto-activate for Affinity by Canva** (Windows and macOS). While Affinity
  runs, fonts its open documents ask for are switched on, and switched back
  off when it quits. Needs Affinity 3.2+ with *Model Context Protocol* enabled.
  Off by default. Talks only to `localhost:6767` — nothing leaves the machine.
- **Auto-activate imported fonts**, an opt-in Settings toggle for batches
  under 64 fonts.
- Sidebar filters for **Activated**, **Activated until close**, **Deactivated**,
  **Last imported** and **System fonts**, each reachable from the command
  palette.
- Duplicate detection on import: fonts already in the library are reported and
  skipped instead of being added twice.
- Per-file actions in the name-conflict panel.
- **Select every font in view** with <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>A</kbd>,
  or *Select all* in the command palette, so a whole library — or whatever the
  current filters and search have narrowed it to — can be activated or
  deactivated in one action, with undo.

### Fixed

- Imported fonts were reported to the interface as inactive even when
  *auto-activate imports* was on and they had in fact been activated, so the
  library showed the wrong state until the next rescan.
- The Affinity watcher enumerated every running process every two seconds even
  when the feature was switched off, which was the default. It now does that
  only while the feature is enabled, and never starts at all on Linux, where
  Affinity does not exist.
- Deactivating a font that had been added with *Add to library* moved the
  original file out of its folder on macOS. Linked fonts are now linked and
  unlinked instead, leaving the original untouched.
- Fonts added with *Add to library* were invisible to other applications on
  Linux and macOS, because they sat outside the directories those systems
  scan.
- Removing a font added with *Add to library* only unregistered it on Windows.
  On Linux and macOS the font stayed available to other applications after it
  had been removed from the library.
- Opening Settings probed for Affinity even when Affinity auto-activation was
  switched off. Nothing is contacted now unless the feature is on, and the
  panel says *Disabled* instead of reporting it as offline.
- The source badge in the name-conflict panel showed *Managed* and *User* in
  English in every language.

### Changed

- The Privacy section of the README now lists, in a table, every feature that
  can open a connection, what it contacts and whether anything leaves your
  machine. Today that is one row, it is off by default, and it is loopback.
- **`CONTRIBUTING.md`** now sets out what a contribution has to satisfy: it must
  work on Linux, Windows and macOS; a genuinely platform-bound feature has to be
  declared, gated, hidden on platforms it cannot serve, and written up in the
  README; and any new interface text has to land in all nine languages with the
  plural forms each one requires.
- README documents the new import modes, the Affinity integration, the
  state filters in the sidebar and the name-conflict panel, and the Privacy
  section now states the local-loopback exception instead of claiming no
  network activity at all.
- All eight translations are complete again: German, Spanish, French,
  Japanese, Portuguese (Brazil), Russian, Simplified and Traditional Chinese
  each cover every string, with the plural forms their language requires.

## [0.3.0] — 2026-09-11

### Added

- **Apply a font in Photoshop or Illustrator** (Windows and macOS). Right-click a
  family → *Apply in Photoshop…* / *Apply in Illustrator…*, or use the command
  palette with a family selected. ZFontManager talks to the *running* app
  (COM on Windows, AppleScript on macOS) and switches every selected text
  layer or text frame to the font; with nothing selected it adds a new text
  layer using the family name as sample text. A sleeping font is woken "until
  close" first, so auditioning never installs anything permanently. Every
  outcome is reported in a toast (applied with layer count, layer created,
  app not running, no open document, app hasn't refreshed its font list yet).
  **Not yet verified against a real Photoshop/Illustrator** — the app-side
  plumbing and scripts are tested up to the Adobe boundary only. Feedback
  welcome.
- Adding or removing a watched folder now indexes the library immediately,
  shows the progress inline in Settings, and reports what changed
  ("3 new fonts found", "4 fonts removed", or that no font files were found).
- Linux bundles (AppImage, .deb, .rpm) are now built by the GitHub Actions
  workflow alongside the Windows and macOS installers, and
  `prepare-release.mjs` refreshes the website download page and checksums.

### Fixed

- **Watched folders on Windows.** Fonts in a folder added in Settings were
  shown as active, could not be deactivated ("font not found in per-user
  registry"), and every card said "This format can't be previewed yet".
  - Activation is now driven by what Windows itself lists in the font
    registry (read through the Win32 API instead of scraping `reg.exe`
    output). Fonts from a watched folder start *inactive*; switching one on
    registers it for your user account right where it is — external drives
    included — and switching it off unregisters it, without errors when there
    was nothing to unregister. Original registry names are remembered so a
    round trip leaves the registry exactly as it was.
  - Fonts registered from outside the per-user font folder are loaded again
    at app start so they are available to other apps immediately.
  - Bulk activation keeps going past a failing file and always persists what
    was applied.
- **Previews for fonts outside the standard folders.** Watched folders (and
  on Linux `/usr/local/share/fonts`) were never allowed through the preview
  asset scope, so their fonts could not render. Every scanned folder is now
  allowed at startup and whenever the folder list changes.
- **Constant GPU load.** A perpetual background-gradient animation kept the
  compositor busy on every frame and forced the blurred sidebar and detail
  panel to re-blur continuously — up to ~50 % GPU on large displays and
  integrated GPUs. The gradient is now static; idle GPU use drops to zero.
- The in-app "Reduce motion" setting now also disables CSS animations
  (skeleton shimmer, toast flashes), not only the interface springs.
- macOS: a deactivated (parked) font lost its preview, glyph map and
  OpenType feature list because those were read from the original path.
- Registry entries ZFontManager writes on Windows now use the names Windows
  itself would use: `(OpenType)` for CFF files, every face named for
  collections, and a numbered suffix when a name is already taken.

### Changed

- All nine languages gained the strings for the features above.

## [0.2.0] and earlier

Earlier releases predate this changelog. Their installers remain available on
the [download page](https://zsync.eu/zfontmanager/).

[0.3.0]: https://github.com/TheHolyOneZ/ZFontManager/releases/tag/v0.3.0
