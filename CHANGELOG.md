# Changelog

All notable changes to ZFontManager are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

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
