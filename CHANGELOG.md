# Changelog

All notable changes to ZFontManager are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.9.0] — 2026-10-28

### Added

- **Nerd Fonts in the online browser.** The Online section has a second tab
  that lists every font in the latest official
  [Nerd Fonts](https://www.nerdfonts.com/) release (72 families today,
  JetBrainsMono, Noto, FiraCode and Hack among them), with search, the
  original font each one is patched from, its licence and a live preview.
  Pick the variants you want — **Nerd Font**, **Mono** for terminals that
  need every icon in one cell, **Propo** for interfaces — and add the family
  with one click. The archive comes straight from the
  ryanoasis/nerd-fonts release and is checked against the SHA-256 checksum
  published with it before anything is installed. The licence files from the
  archive are saved with the font, and fonts whose original name is reserved
  show why Nerd Fonts renamed them (Source Code Pro becomes SauceCodePro).
  The preview shows the original font, so opening a family downloads one small
  file instead of the whole archive.

  Suggested by VortexFlickens. (#24)

- **Cover images and a Cards view.** Any family can now have a cover image —
  a specimen poster, a screenshot, anything that helps you recognise it. Set
  it from the right-click menu, the new Cover section in the detail panel, or
  the button on a tile. A cover shows as a thumbnail on the font's card in the
  Grid and List views and as a banner at the top of the detail panel, with
  buttons to change or remove it. The new **Cards** view in the top bar shows
  the library as a gallery of tiles with those covers; families without one
  show their name in their own typeface. Covers are copied into the app's data
  folder, so moving or deleting the original image doesn't lose them. PNG,
  JPEG, WebP, GIF and BMP files up to 25 MB are accepted, and the file's
  contents are checked, not just its extension.

  Suggested by Domi94sosa. (#23)

### Changed

- The online browser now also contacts `github.com` and
  `release-assets.githubusercontent.com`, for the Nerd Fonts releases. Both
  are listed under the toggle in Settings, still only when you open the Nerd
  Fonts tab or download, and redirects are only followed to these listed
  hosts.
- **The search and sample text fields no longer shrink to nothing.** With the
  detail panel open or in a small window, they used to be squeezed down to
  their icons. The top bar now adapts to its width: the Sort and Compare
  buttons drop their labels first, and when it gets tighter the two fields
  move onto their own full-width row above the other controls.
- The view buttons in the top bar have labels for screen readers and a
  tooltip.
- All nine languages have the new strings.

## [0.8.1] — 2026-10-26

### Fixed

- **Linux and macOS: a linked font was reported as a name conflict with
  itself.** A font added with **Add to library** stays where it is, and
  activating it puts a link to it in the library folder. The scan followed
  that link and found the font a second time, so the original and the link
  showed up as two files with the same name and every activated linked font
  got a conflict badge. A link that points at a linked font is now recognised
  as the same font and the library keeps one entry with the original path, so
  activating and deactivating work as before. A real second copy of a font is
  still reported.

  Reported by chinchah-lab, with the exact code path. (#21)

### Changed

- **Collections and tags can be picked several at a time.** Ticking a
  collection or tag in the right-click menu no longer closes it, so a font, or
  a selection of fonts, can go into several collections in one go. Each tick
  shows straight away; Esc or a click outside closes the menu. If saving a
  collection for a selection fails, the change is now undone and reported
  instead of failing silently.

  Suggested by emuspawn. (#20)

## [0.8.0] — 2026-10-23

### Fixed

- **Affinity only got one style of a family.** When a document used a font,
  the Affinity integration switched on that one file and nothing else, so a
  document set in Regular left the other eleven styles of a twelve-style family
  asleep and Affinity's font menu offered Regular alone. A matched font now
  wakes its whole family, the way Affinity lists it. Only styles that were off
  are switched on, so quitting Affinity no longer turns off styles you had
  activated yourself.

- **A family looked active when only one of its styles was.** The family switch
  was on as soon as any single style was active, which hid the problem above:
  there was no reason to click it. Families now have a third state. A partly
  active family shows a centred switch and "Partly active · 1 of 12 styles" in
  the detail panel, and one click activates the styles that are missing. It
  appears under both **Activated** and **Deactivated** in the sidebar.

- **Affinity font names with spaces in the family were never matched by
  family.** PostScript names drop the spaces ("SourceSerif4-Semibold"), and the
  fallback compared them against the spaced family name, so it found nothing.
  Names are now compared with spaces and hyphens ignored. A name that matches
  no family in the library is skipped instead of being guessed.

- **Windows: a font Windows refused to load still counted as active.** The
  result of loading the file was never checked, so a font could be registered,
  shown as active and still be missing from every other app. The file is now
  loaded first and only registered once that worked; if registering fails, it
  is unloaded again. Either way the toggle reports the error.

- **Turning on part of a batch reported only the first error.** Activating a
  family or a selection now says how many files failed ("3 of 12 fonts
  failed: ..."), and the library reloads its real state instead of flipping
  every switch back as if nothing had changed.

- **macOS: activating a font that was already active failed** with "no parked
  copy recorded", which would have broken activating the rest of a partly
  active family. It is now a no-op. A failed move back out of the parking
  folder also no longer forgets where the file was parked.

- **Activate until close could turn off styles that were already on.** It sent
  every file of the family, so closing the app deactivated styles you had
  switched on permanently. It now only sends the ones that were off.

Reported by zeusextremachine on Windows with Affinity by Canva, with an
unusually thorough investigation. (#18)

### Added

- **An activation log.** Every activation and deactivation is written to
  `activation.log` in the app data folder, with the result for each file and
  the names inside it (family, style, full and PostScript name). On Windows it
  also records how many fonts Windows loaded from the file and which registry
  entry was written. When a file claims the same name as one already
  activated, or shares its PostScript name with another file the library scan
  found (system fonts included), the log warns about it: apps then show only
  one of the two, which looks exactly like a missing style. Fonts Windows refuses to load at startup
  are logged too. The log stays under 1 MB.

### Changed

- All nine languages gained the string for partly active families.
- `pnpm test` runs tests for the Affinity matching and family states, and the
  Rust side has tests for the log.

## [0.7.2] — 2026-10-15

### Fixed

- **The Affinity connection status in Settings did not refresh while the panel
  was open.** It showed whatever it found the moment you opened Settings, so
  during the startup grace period added in 0.7.1 it could sit on
  "Offline · Affinity link failed..." long after Affinity had connected. That
  wording is identical to one of the errors from #16, which made a working
  installation look like a failed one. The panel now follows the link live.

- **Opening Settings could connect to Affinity during its startup.** The status
  check ran a full connection of its own, outside the grace period that keeps
  the watcher away from Affinity while it starts — so opening Settings at the
  wrong moment could trigger the very crash 0.7.1 fixes. The watcher now
  publishes what it already knows, and the panel reads that instead of opening
  a connection. The *Test connection* button still probes on demand, as before.

  Found while testing 0.7.1 on Windows.

## [0.7.1] — 2026-10-15

### Fixed

- **Affinity could be taken down at startup by the font activation
  integration.** Affinity's MCP server starts accepting connections before the
  application has finished initialising, and ZFontManager connected to it the
  instant the process appeared — often while Affinity was still on
  "Initializing...". The request landing in that window could close Affinity
  with no error dialog, and left ZFontManager showing
  "preamble read failed: error decoding response body" or a failed link to
  `localhost:6767/sse`.

  ZFontManager now leaves Affinity alone for the first 20 seconds after it
  appears, and if the link still fails it retries with a widening gap (10s,
  20s, 40s, up to two minutes) instead of reconnecting on every pass. A failed
  link is only reported after three consecutive attempts, so a slow start no
  longer raises an error you need to dismiss.

  One consequence worth knowing: fonts for a document open at launch are now
  activated a short time after Affinity starts rather than immediately.

  Reported by zeusextremachine on Windows 11 with Affinity 3.3.1. (#16)

- **The Affinity link is far less demanding in general.** Reviewing the above
  turned up three further problems in the same code:

  - Every poll reopened a session from scratch, retrying all three loopback
    spellings and up to three protocol versions each time. The working address
    and protocol are now remembered after the first success and tried first,
    so a healthy link is one connection rather than up to nine attempts. Both
    are forgotten again on failure, so a changed setup is still found.
  - Documents were re-queried every 10 seconds, each time with a complete
    handshake. That is now every 30 seconds.
  - A server that accepted the connection but did not report its own version
    string was treated as having refused every protocol version, and the link
    failed for no reason. Acceptance and the reported version are now tracked
    separately.

## [0.7.0] — 2026-10-12

### Added

- **Copy a font's name with one click.** Click the family name in the detail
  panel to copy it, or the PostScript name in the metadata list to copy that
  instead. Useful when an application has no font picker and expects you to
  type the name into a config file by hand. (#14)

- **System tray.** ZFontManager can now live in the tray. Three new settings
  under *System*:

  - **Close to tray** — the close button hides the window instead of quitting.
  - **Start with system** — launch at sign-in.
  - **Start minimised** — start in the tray without opening the window.

  All three are off by default, so nothing changes unless you turn them on.

  On Windows, left-click the tray icon to bring the window back and right-click
  for the menu. On macOS and Linux the menu opens on click, following each
  platform's convention — Linux desktops do not deliver tray click events to
  the application at all, so the menu is the way back. If the tray cannot be
  created, *Close to tray* stays inactive rather than leaving you with no way
  to reach the window. (#15)

### Changed

- Tauri updated from 2.11.5 to 2.12.3, which the autostart integration
  requires. This also moves the underlying webview layer (wry) from 0.55 to
  0.57.

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
