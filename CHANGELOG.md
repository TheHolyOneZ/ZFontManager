# Changelog

All notable changes to ZFontManager are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.6.1] — 2026-09-22

### Added

- **Show only your own fonts.** A new *Show* filter at the top of the filter
  menu switches between all fonts, system fonts, and the fonts you installed
  yourself. On a machine with several hundred system faces, finding the ones
  you added by hand no longer means scrolling past everything the OS shipped.
  It composes with the other filters, so you can narrow to your own fonts and
  then filter those by format, feature or character.

  Requested by a user who found their own fonts hard to pick out of the list.

## [0.6.0] — 2026-09-21

Everything here comes from one report by a tester running Fedora on a 1366x768
ThinkPad. 

### Added

- **Interface scale.** ZFontManager now measures the usable area of your screen
  at startup and picks a scale that fits the whole interface into it, so a
  small or low-resolution display shows the entire layout instead of a cropped
  one. Settings → Appearance → *Interface scale* overrides it: **Auto**, or a
  fixed 80–125% if you would rather decide, which also serves anyone on a large
  display who simply wants the interface bigger.
- **Reduce transparency.** A new Appearance setting that replaces the frosted
  glass with solid panels. It is easier to read, it is the accessible choice,
  and it removes the most expensive thing the app draws — which makes a real
  difference on older integrated graphics.
- **Filter by file format.** OpenType, TrueType, WOFF and WOFF2, in the filter
  menu alongside classification and language support.
- **Filter by typographic feature.** Swashes, stylistic alternates,
  discretionary ligatures, small caps, oldstyle figures and fractions. The
  feature list is now read while the library is indexed rather than only when a
  font is selected, so it can be filtered on. If you are hunting for faces with
  alternate letterforms, this is the fastest way to find them.
- **Find fonts containing a specific character.** Type any character into the
  filter menu and the library narrows to the fonts whose character map covers
  it. The search reads every font file, so it runs on demand rather than
  continuously, and it reports the codepoint it resolved your character to.
- **Glyph count.** Shown in the inspector, and available as a sort order.
- **Collapsible sidebar sections.** Browse, Collections and Tags each fold away,
  and stay folded between launches.
- **Sort by glyph count**, next to name, styles and size.

### Fixed

- **The window could open taller than the screen.** The default size is right
  for the displays the app was designed against, but nothing checked whether it
  fitted. On a 1366x768 screen roughly a hundred pixels of the app sat below
  the bottom edge once the desktop panel was counted, which among other things
  hid the inspector's Tags section. The window is now measured against the
  monitor's usable area — panels, docks and taskbars excluded — and clamped and
  centred to fit. The configured default is unchanged, so nothing moves on a
  display that was already big enough.
- **The context menu could not be scrolled.** It had no height limit, so with
  enough tags the "Tag all" menu grew past the screen and lost its top. It now
  scrolls, and can no longer be positioned off the top or left edge.
- **Panels turned unreadable when the compositor could not blur.** Every
  overlay — the context menu, Compare, Settings, the selection bar — was a
  ten-percent-white surface that relied entirely on a backdrop blur to become
  legible. Where that blur silently does nothing, the panel was a haze. The new
  *Reduce transparency* setting makes them solid.
- **No resize handles.** ZFontManager draws its own title bar, and drawing your
  own means the window has no resize border unless you provide one. There was
  none, so the edges were a one-pixel guessing game. All four edges and corners
  are now grabbable, with the right cursor on each. This affected Windows and
  macOS too.
- **The online font browser ignored the preview size slider**, rendering every
  preview at a fixed size while the rest of the library followed the control.

### Notes

- The tiny flickering squares reported on Intel HD 4000 with the crocus driver
  are not drawn by the app and were not reproducible away from that hardware.
  *Reduce transparency* removes the most likely trigger; if you see them, please
  try it and say whether it helps.

## [0.5.1] — 2026-09-19

### Fixed

- **The sidebar now scrolls.** It had no scroll region at all, so once Browse,
  Collections and Tags together grew taller than the window, everything past
  the bottom edge was silently cut off — the Tags section first, then Trash,
  About and Shortcuts. 0.4.0 made this easy to hit by adding four rows to
  Browse. Browse, Collections and Tags now scroll; Trash, About and Shortcuts
  stay pinned at the bottom. Affected every platform.
- The onboarding tour scrolls its target into view before drawing the
  spotlight, so a step can no longer point at something below the window edge.

## [0.5.0] — 2026-09-17

### Added

- **Online font browser.** Search nearly two thousand open-licence families —
  the whole Google Fonts catalogue — and add any of them to the library with
  one click, from a new *Online* section in the sidebar. Filter by category,
  licence and variable-only. Each family shows its designer, licence, a link to
  the full licence text and its Reserved Font Name before you download; the
  licence text is stored alongside the font. Downloaded families are tagged
  *Online* automatically and marked *In library* in the browser afterwards.

  This is the first feature that contacts a real server, so the rules are
  strict and enforced in one place. Off by default. Switching it on sends
  nothing — a request goes out only when you open the section and search or
  download; there is no background refresh and no probe on startup. The
  catalogue is fetched once from `api.fontsource.org` and cached for seven
  days; search runs locally against that cache, debounced, so the provider
  sees one request a week rather than one per keystroke. Font files and
  licences come from the `google/fonts` repository via
  `raw.githubusercontent.com` — the canonical source, and the only one that
  serves complete fonts rather than per-script web subsets. Both hosts are
  named under the toggle. Every request passes through a single client that
  refuses if the setting is off, rejects any host not on that two-entry list,
  follows no redirects, and identifies itself as ZFontManager.

  The licence shown is read from the repository directory the files are
  actually fetched from, so it is by construction the licence that ships beside
  the font; the catalogue's licence field only decides which directory to try
  first.

  Opening a family shows a live preview of your current sample text in that
  font. One face — the Regular — is fetched for the preview through the same
  gated client, and if you then add the family the download reuses that file
  rather than fetching it again. Closing the family without adding it removes
  the preview file.

  Bunny Fonts and Fontsource's own CDN were evaluated and rejected as download
  sources: both serve only WOFF/WOFF2 or per-script subsets, which Windows
  cannot install and which would put a dozen partial copies of each style in
  the OS. Fontshare was rejected because the ITF Free Font Licence forbids
  redistribution.

- **System fonts now say why they can't be turned off.** On Windows and macOS
  the operating system owns its own fonts, and until now a system font showed
  a dimmed activation toggle that looked switched on but did nothing. It now
  shows a small lock badge reading *OS*, with the full explanation on hover:
  managed by the operating system, can't be turned off. On Linux, where
  fontconfig can exclude any font, the toggle is unchanged.
- **Hide them entirely.** The filter menu gains *Hide fonts the OS won't let
  you turn off*, so the library can show only what you can actually act on.
  It counts toward the filter badge and clears with the other filters.

### Changed

- `reqwest` now carries a TLS backend (`rustls`, using the OS trust store). It
  was built without one, which was fine for the Affinity integration's loopback
  HTTP but would have failed on any `https://` request.

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
[0.5.1]: https://github.com/TheHolyOneZ/ZFontManager/releases/tag/v0.5.1
[0.6.0]: https://github.com/TheHolyOneZ/ZFontManager/releases/tag/v0.6.0
