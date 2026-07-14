<div align="center">

<img src="src-tauri/icons/128x128.png" alt="ZFontManager icon" width="110" />

# ZFontManager

**The font manager Linux never got — and Windows &amp; macOS make you pay for.**

Preview, organize, activate and install fonts across all three desktop platforms,<br>
from one clean, fast, native app. Your fonts never leave your machine.

<br>

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-7c3aed?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.1.0-5b21b6?style=flat-square)](https://zsync.eu/zfontmanager/)
[![Platform](https://img.shields.io/badge/Platform-Linux%20·%20Windows%20·%20macOS-2d2a4a?style=flat-square)](#-platform-notes)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%20v2-24C8DB?style=flat-square)](https://tauri.app)

<br>

**[⬇ Download](https://zsync.eu/zfontmanager/)** ·
**[🌐 Website](https://zsync.eu)** ·
**[💻 Source Code](https://github.com/TheHolyOneZ/ZFontManager)** ·
**[👤 The Developer](https://github.com/TheHolyOneZ)**

<br>
<br>

<img src="main.png" alt="ZFontManager — library view with live font previews, activation toggles and the detail panel" width="920" />

<sub>The library: every family rendered live, one toggle away from any app's font menu.</sub>

</div>

<br>

---

## 📖 Table of contents

- [Why ZFontManager?](#-why-zfontmanager)
- [Feature tour](#-feature-tour)
  - [Your whole library, rendered live](#your-whole-library-rendered-live)
  - [Activate &amp; deactivate — the killer feature](#activate--deactivate--the-killer-feature)
  - [Try a font before committing](#try-a-font-before-committing)
  - [Installing fonts](#installing-fonts)
  - [A trash can, not a shredder](#a-trash-can-not-a-shredder)
  - [Organize: tags, collections, favorites, notes](#organize-tags-collections-favorites-notes)
  - [Find anything](#find-anything)
  - [Compare fonts side by side](#compare-fonts-side-by-side)
  - [The waterfall view](#the-waterfall-view)
  - [Peek inside a font](#peek-inside-a-font)
  - [Export a specimen sheet](#export-a-specimen-sheet)
  - [The command palette](#the-command-palette)
  - [Themes, sound &amp; motion](#themes-sound--motion)
  - [Back up your curation](#back-up-your-curation)
- [Keyboard shortcuts](#-keyboard-shortcuts)
- [Getting ZFontManager](#-getting-zfontmanager)
- [Platform notes](#-platform-notes)
- [Privacy](#-privacy)
- [FAQ](#-faq)
- [Building from source](#-building-from-source)
- [About the developer](#-about-the-developer)
- [License](#-license)

---

## 💡 Why ZFontManager?

If you've ever worked with type on Linux, you know the drill: fonts live in
scattered folders, previewing means opening each file one by one, and
"managing" them means a terminal and crossed fingers. On Windows and macOS
the situation is better — but the good tools cost real money.

ZFontManager is the answer to both:

- **One app, three platforms.** The same clean interface on Linux, Windows and macOS.
- **Native and fast.** Not a website in a box — it starts quickly, scrolls
  smoothly through hundreds of families, and feels at home on your desktop.
- **Yours.** Free, open source (GPL-3.0), no account, no cloud, no telemetry.
  Everything happens on your machine.

> [!NOTE]
> ZFontManager is currently at **version 0.1.0**. It's already very usable
> day-to-day, but expect the occasional rough edge — and please
> [report anything odd](https://github.com/TheHolyOneZ/ZFontManager/issues)!

---

## ✨ Feature tour

### Your whole library, rendered live

On first launch, ZFontManager scans the standard font locations on your
system — both the system-wide ones and your personal user fonts — and builds
your library automatically. You can add extra folders to watch in Settings,
and the app notices when new fonts appear in them.

Every font family is shown **in its own typeface**, not as a generic name in
a list. Type any sentence into the preview box at the top — your brand name,
a headline you're working on — and the *entire library* re-renders in it
instantly. A size slider takes the preview anywhere from small print to
poster size.

Fonts with many weights and italics are grouped into a single family card.
Expand the card and every style — Light, Regular, Bold, Black, the italics —
renders live underneath.

Three views, switchable from the top bar:

| View | What it's for |
|---|---|
| **Grid** | Big, comfortable cards — the browsing view |
| **List** | Compact rows with style count, format and size — the overview |
| **Waterfall** | One family shown at every size at once — the type-nerd view |

### Activate &amp; deactivate — the killer feature

This is what separates a font *manager* from a font *viewer*.

A huge font library is wonderful — until you open the font picker in your
design app and have to scroll past 900 entries. **Deactivating** a font in
ZFontManager removes it from other applications' font menus *without
uninstalling it*. The files stay exactly where they are; the font just goes
to sleep. Flip the toggle again and it's back.

- Toggle a single family with one click (or press <kbd>Space</kbd>)
- Select many families and activate/deactivate them all at once
- Deactivated fonts stay in your library, gently dimmed, ready to wake up

Each platform has its own proper mechanism under the hood (see
[Platform notes](#-platform-notes)) — but from where you sit, it's just a
switch.

> [!TIP]
> Keep your everyday fonts active and park the other 800 decorative ones.
> Your design app's font menu becomes usable again, and every font is still
> one click away.

### Try a font before committing

Not sure you want that font cluttering your menus permanently? Right-click →
**"Activate until close"** wakes a font up *for this session only*. When you
quit ZFontManager, it's automatically put back to sleep. Perfect for
auditioning a typeface in your design app without any cleanup afterwards.

### Installing fonts

Drag anything into the window:

- individual font files (TTF, OTF, TTC, WOFF and friends),
- whole folders,
- even **ZIP archives** — fresh from a font site, no unzipping needed.

ZFontManager installs them into your user font directory, and they appear in
the library immediately. A progress toast keeps you informed on big drops.

### A trash can, not a shredder

Uninstalling a font never silently deletes anything. Removed fonts go to a
**restorable Trash** inside the app — the actual files are kept safe. Made a
mistake? Open the Trash tab, hit Restore, and the font is back exactly where
it was. Only "Empty Trash" or a per-item "Delete permanently" actually
removes files, and both are clearly marked.

### Organize: tags, collections, favorites, notes

Four complementary ways to impose order on font chaos:

- **Tags** — free-form labels on any family ("condensed", "80s", "client-x").
  Tags appear in the sidebar and act as instant filters. Tag many fonts at
  once via multi-select.
- **Collections** — folders you curate by hand, per project or per client.
  Right-click any font → Collections → add it. A font can live in as many
  collections as you like.
- **Favorites** — one star for your go-to typefaces, with its own sidebar view.
  Press <kbd>F</kbd> on any selected font.
- **Notes** — a small text field per family for things you'd otherwise
  forget: *"licensed for Client X only"*, *"kerning breaks above 60px"*.

### Find anything

- **Search** by name, live as you type (press <kbd>/</kbd> to jump to the box).
- **Filter** by classification — Serif, Sans, Mono, Script, Display and more.
- **Filter** by writing system — Latin, Cyrillic, Greek, and others.
- **Variable fonts only** — one switch to see just the flexible ones.
- **Sort** by name, style count, or file size.

Filters combine, and the empty state always tells you which filters are
active so you're never staring at a mysteriously empty library.

### Compare fonts side by side

Select two to four families — <kbd>Ctrl</kbd>+Click each one, or hold
<kbd>Shift</kbd> and use the arrow keys — and a small bar appears at the
bottom of the window with a **Compare** button. Click it (or just press
<kbd>C</kbd>, or right-click the selection) and the compare view opens: the
same preview text rendered in parallel, resizable, so you can finally settle
"which of these three sans-serifs is *the one*" with your own eyes instead
of your memory.

### The waterfall view

One family, every size from small to huge, stacked on one screen. This is
how type designers evaluate a font — you can instantly see where it gets
muddy, where the details shine, and whether it holds up at footnote size.

### Peek inside a font

Click any family and the detail panel slides in:

- **Every style** listed with live samples and per-style export
- **Variable font axes** — drag sliders for weight, width, slant and
  whatever else the font offers, and watch the preview morph in real time
- **OpenType features** — ligatures, small caps, stylistic alternates,
  oldstyle numerals… toggle them and see exactly what they do before you
  enable them in your design app
- **Character map** — every glyph the font actually contains; click a
  character to copy it
- **The practical facts** — format, file size, file path, license info when
  the font declares one, plus your tags and notes

### Export a specimen sheet

Right-click a family → **Export specimen** and get a beautiful, shareable
PNG type specimen — the classic "alphabet + sizes + sample text" sheet.
Perfect for sending to a client ("option A or option B?") without them
needing the font installed.

You can also export the font files themselves (single style or whole
family), or export your entire font list as metadata for spreadsheet people.

### The command palette

Press <kbd>Ctrl</kbd><kbd>K</kbd> and type. Jump to any view, open any
collection, switch themes, rescan, find a specific font by name — everything
in the app is a few keystrokes away. If you use it in your editor or
browser, it works exactly the way you expect.

### Themes, sound &amp; motion

- **Dark and light themes**, plus a System option that follows your desktop.
  Same glass aesthetic, different light.
- **Interface sounds** — soft, synthesized feedback for toggles and events.
  Three levels: on, subtle, or off.
- **Reduced motion** — replaces the springy animations with quick fades,
  independently of (or together with) your system-wide preference.
- A **first-launch tour** glides a spotlight over the interface and teaches
  the essentials in a minute. Replayable anytime from Settings.

<div align="center">

<img src="settings.png" alt="ZFontManager settings — watched folders, backup, theme, reduced motion and interface sounds" width="820" />

<sub>Settings: watched folders, one-file backup, themes, motion and sound to taste.</sub>

</div>

### Back up your curation

Your tags, collections, favorites and notes are the real work — the fonts
themselves you can always re-download. Settings → **Export library data**
saves all of it to a single file; **Import** merges it back in, on this
machine or another one.

---

## 🎹 Keyboard shortcuts

The whole app is keyboard-navigable — every card, button and menu. Press
<kbd>?</kbd> inside the app (or click **Shortcuts** in the sidebar) for this
same list in a pretty overlay.

<details open>
<summary><b>Navigate</b></summary>
<br>

| Keys | Action |
|---|---|
| <kbd>Ctrl</kbd> <kbd>K</kbd> | Open the command palette |
| <kbd>/</kbd> | Jump to search |
| <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> | Move through the library |
| <kbd>Home</kbd> / <kbd>End</kbd> | First / last font |
| <kbd>Tab</kbd> | Walk every control, font cards included |
| <kbd>Esc</kbd> | Close panels, deselect |

</details>

<details open>
<summary><b>Select</b></summary>
<br>

| Keys | Action |
|---|---|
| <kbd>Enter</kbd> | Select the focused card |
| <kbd>Shift</kbd> <kbd>↑</kbd>/<kbd>↓</kbd> | Extend the selection |
| <kbd>Ctrl</kbd> + Click | Add a font to the selection |
| <kbd>Shift</kbd> + Click | Select a range |

</details>

<details open>
<summary><b>Act on the selection</b></summary>
<br>

| Keys | Action |
|---|---|
| <kbd>Space</kbd> | Activate / deactivate |
| <kbd>C</kbd> | Compare the selected fonts (2–4) |
| <kbd>F</kbd> | Favorite / unfavorite |
| <kbd>Del</kbd> | Move to Trash (always restorable) |
| <kbd>Shift</kbd> <kbd>F10</kbd> or <kbd>≡ Menu</kbd> | Open the context menu — arrows browse it |
| <kbd>?</kbd> | Show the shortcuts overlay |

</details>

---

## 📦 Getting ZFontManager

The easiest way is the official download page, which always has the latest
build for your platform:

<div align="center">

### **[zsync.eu/zfontmanager](https://zsync.eu/zfontmanager/)**

</div>

Prefer to build it yourself? See
[Building from source](#-building-from-source) below — it's three commands.

---

## 🧭 Platform notes

ZFontManager speaks each operating system's native font language — no hacks,
no "portable font folder" tricks.

<table>
<tr><th align="left">Platform</th><th align="left">How activation works, in plain words</th></tr>
<tr>
<td><b>🐧 Linux</b></td>
<td>Uses <i>fontconfig</i>, the same system every Linux app reads fonts
through. Deactivating tells fontconfig to skip the font — apps simply stop
offering it. Nothing is moved or deleted.</td>
</tr>
<tr>
<td><b>🪟 Windows</b></td>
<td>Uses the per-user font registration Windows itself uses. Deactivating a
font unregisters it for your user account; the file stays put. No admin
rights needed for your own fonts.</td>
</tr>
<tr>
<td><b>🍎 macOS</b></td>
<td>Uses a managed move-aside: deactivated fonts are parked in a dedicated
folder the app controls, and restored to the exact original location on
reactivation.</td>
</tr>
</table>

> [!IMPORTANT]
> Some applications only refresh their font list when they start. If a
> newly activated font doesn't show up in an app that's already running,
> restart that app — that's the app's cache, not a lost font.

> [!WARNING]
> **System fonts are protected.** Fonts your operating system needs to draw
> its own interface can't be deactivated or trashed from ZFontManager, so
> you can explore fearlessly.

---

## 🔒 Privacy

Short version: **there is nothing to worry about, because there is nothing
being sent.**

- ❌ No account, no sign-up, no license key
- ❌ No telemetry, no analytics, no crash reporting
- ❌ No network requests at all during normal use
- ✅ Your fonts, tags, collections and notes live in local files on your machine
- ✅ The only time the app touches the internet is when *you* click one of
  the links on the About page — and that just opens your browser

Don't take our word for it — the entire source code is
[public](https://github.com/TheHolyOneZ/ZFontManager).

---

## ❓ FAQ

<details>
<summary><b>Does deactivating a font delete it?</b></summary>
<br>
No. Deactivating only hides the font from other applications' font menus.
The files stay exactly where they are, and the font stays in your
ZFontManager library (shown dimmed). One click brings it back.
</details>

<details>
<summary><b>I uninstalled a font by accident. Is it gone?</b></summary>
<br>
No — it's in the Trash tab, and the actual files are kept safe. Click
<i>Restore</i> and it goes back exactly where it came from. Fonts are only
truly removed when you explicitly choose <i>Delete permanently</i> or
<i>Empty Trash</i>.
</details>

<details>
<summary><b>Will this mess with my system fonts?</b></summary>
<br>
No. Fonts the operating system needs are protected — the app won't let you
deactivate or trash them.
</details>

<details>
<summary><b>Which font formats are supported?</b></summary>
<br>
The common desktop formats: TTF, OTF, TTC collections, WOFF/WOFF2, and
variable fonts. If your design app can use it, ZFontManager can almost
certainly manage it.
</details>

<details>
<summary><b>A font I activated doesn't appear in my design app.</b></summary>
<br>
Most likely the app was already running and only reads the font list at
startup. Restart the app and the font will be there. (Some apps also have
their own "refresh font list" command.)
</details>

<details>
<summary><b>Can I move my tags and collections to another computer?</b></summary>
<br>
Yes — Settings → <i>Export library data</i> gives you a single backup file
containing your tags, collections, favorites and notes. Import it on the
other machine and it merges in.
</details>

<details>
<summary><b>Is it really free?</b></summary>
<br>
Really free. Free to use, free to share, and the source code is free to
read and modify under the GPL-3.0 license. There is no paid tier, no
"pro" version, no unlock.
</details>

<details>
<summary><b>Something broke. Where do I complain?</b></summary>
<br>
Please do! Open an issue on
<a href="https://github.com/TheHolyOneZ/ZFontManager/issues">the GitHub issue tracker</a>
with what you did and what happened. Screenshots help a lot.
</details>

---

## 🔧 Building from source

You don't need to understand the code to build it — just have
[Node.js](https://nodejs.org) (with `pnpm`), [Rust](https://rustup.rs), and
the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your
platform installed. Then:

```sh
git clone https://github.com/TheHolyOneZ/ZFontManager.git
cd ZFontManager
pnpm install
pnpm tauri build
```

The finished installer/bundle lands in `src-tauri/target/release/bundle/`.
For a live development window instead, use `pnpm tauri dev`.

<details>
<summary>For the curious: what it's made of</summary>
<br>

| Layer | Technology |
|---|---|
| App shell &amp; system integration | Tauri v2 + Rust |
| Interface | React 19 + TypeScript |
| Animation | Motion (spring-based) |
| Build tooling | Vite + pnpm |

The Rust side handles everything that touches your system — scanning,
installing, activation, the trash — while the interface side does the
rendering, previews and organization. Design principles and the product
spec live in the <code>docs/</code> folder.

</details>

---

## 👤 About the developer

ZFontManager is built by **[TheHolyOneZ](https://github.com/TheHolyOneZ)** —
born from the simple frustration that Linux never had a proper font manager,
and the good ones elsewhere cost money.

<div align="center">

| | |
|---:|:---|
| 👤 **Developer** | [github.com/TheHolyOneZ](https://github.com/TheHolyOneZ) |
| 🌐 **More projects** | [zsync.eu](https://zsync.eu) |
| ⬇️ **Download &amp; landing page** | [zsync.eu/zfontmanager](https://zsync.eu/zfontmanager/) |
| 💻 **This project's source** | [github.com/TheHolyOneZ/ZFontManager](https://github.com/TheHolyOneZ/ZFontManager) |

</div>

Found it useful? A ⭐ on the repository genuinely helps others discover it.

---

## 📄 License

ZFontManager is free software, released under the
**[GNU General Public License v3.0](LICENSE)**.

In human terms: you may use it, share it, and change it — and if you
distribute a changed version, it must stay just as free for the next person.

---

<div align="center">
<br>

<img src="src-tauri/icons/32x32.png" alt="" width="20" />

**ZFontManager** · your fonts, your machine, your rules

<sub>Made with care (and a mild grudge against font chaos) by
<a href="https://github.com/TheHolyOneZ">TheHolyOneZ</a></sub>

</div>
