import { AnimatePresence, motion } from "motion/react";
import {
  Columns2,
  Command,
  FolderOpen,
  Info,
  Keyboard,
  LayoutGrid,
  Library,
  List,
  RefreshCw,
  Rows3,
  Search,
  Settings,
  Star,
  SunMoon,
  Trash2,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { springSnappy } from "../design/springs";
import { familiesFor, useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";

const IS_MAC = navigator.platform.toUpperCase().includes("MAC");

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}


function score(label: string, q: string): number {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 2000 - l.length;
  if (l.includes(q)) return 1000 - l.length;
  return -1;
}

export function CommandPalette() {
  const open = useFontStore((s) => s.paletteOpen);
  const setOpen = useFontStore((s) => s.setPaletteOpen);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);

      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    if (!open) return [];
    const s = useFontStore.getState();
    const close = () => setOpen(false);
    const base: Cmd[] = [
      {
        id: "nav-library",
        label: "Go to Library",
        icon: <Library size={14} strokeWidth={1.5} />,
        run: () => s.setNav({ kind: "library" }),
      },
      {
        id: "nav-favorites",
        label: "Go to Favorites",
        icon: <Star size={14} strokeWidth={1.5} />,
        run: () => s.setNav({ kind: "favorites" }),
      },
      {
        id: "nav-trash",
        label: "Go to Trash",
        icon: <Trash2 size={14} strokeWidth={1.5} />,
        run: () => s.setNav({ kind: "trash" }),
      },
      {
        id: "nav-about",
        label: "About ZFontManager",
        icon: <Info size={14} strokeWidth={1.5} />,
        run: () => s.setNav({ kind: "about" }),
      },
      ...Object.keys(s.collections)
        .sort((a, b) => a.localeCompare(b))
        .map(
          (name): Cmd => ({
            id: `nav-col-${name}`,
            label: `Open collection: ${name}`,
            icon: <FolderOpen size={14} strokeWidth={1.5} />,
            run: () => s.setNav({ kind: "collection", name }),
          }),
        ),
      {
        id: "view-grid",
        label: "View as grid",
        icon: <LayoutGrid size={14} strokeWidth={1.5} />,
        run: () => s.setViewMode("grid"),
      },
      {
        id: "view-list",
        label: "View as list",
        icon: <List size={14} strokeWidth={1.5} />,
        run: () => s.setViewMode("list"),
      },
      {
        id: "view-waterfall",
        label: "View as waterfall",
        icon: <Rows3 size={14} strokeWidth={1.5} />,
        run: () => s.setViewMode("waterfall"),
      },
      ...(["dark", "light", "system"] as const).map(
        (t): Cmd => ({
          id: `theme-${t}`,
          label: `Theme: ${t[0].toUpperCase()}${t.slice(1)}`,
          icon: <SunMoon size={14} strokeWidth={1.5} />,
          run: () => s.setThemePref(t),
        }),
      ),
      ...(s.selection.length >= 2
        ? [
            {
              id: "compare-selected",
              label: `Compare ${Math.min(s.selection.length, 4)} selected fonts`,
              icon: <Columns2 size={14} strokeWidth={1.5} />,
              run: () => s.openCompare(s.selection),
            } satisfies Cmd,
          ]
        : []),
      {
        id: "rescan",
        label: "Rescan font folders",
        icon: <RefreshCw size={14} strokeWidth={1.5} />,
        run: () => void s.rescan(),
      },
      {
        id: "settings",
        label: "Open Settings",
        icon: <Settings size={14} strokeWidth={1.5} />,
        run: () => s.setSettingsOpen(true),
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        icon: <Keyboard size={14} strokeWidth={1.5} />,
        run: () => s.setHelpOpen(true),
      },
    ].map((c) => ({ ...c, run: () => (close(), c.run()) }));

    const q = query.trim().toLowerCase();
    if (!q) return base.slice(0, 9);

    const ranked = base
      .map((c) => ({ c, r: score(c.label, q) }))
      .filter((x) => x.r >= 0)
      .sort((a, b) => b.r - a.r)
      .map((x) => x.c);


    const fonts: Cmd[] =
      q.length >= 2
        ? [...familiesFor(s.fonts, s.tags).values()]
            .map((f) => ({ f, r: score(f.name, q) }))
            .filter((x) => x.r >= 0)
            .sort((a, b) => b.r - a.r)
            .slice(0, 6)
            .map(({ f }) => ({
              id: `font-${f.name}`,
              label: f.name,
              hint: `${f.faces.length} style${f.faces.length === 1 ? "" : "s"}`,
              icon: <Type size={14} strokeWidth={1.5} />,
              run: () => {
                close();
                s.setNav({ kind: "library" });
                s.select(f.name);
              },
            }))
        : [];

    return [...ranked, ...fonts].slice(0, 12);
  }, [open, query, setOpen]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, commands.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commands[cursor]?.run();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            ref={trapRef}
            className="palette-panel glass-e3"
            initial={{ y: -14, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.985, opacity: 0, transition: { duration: 0.12 } }}
            transition={springSnappy}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command palette"
            onKeyDown={onKey}
          >
            <div className="palette-input">
              <Search size={15} strokeWidth={1.5} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to a font or run a command…"
                aria-label="Command palette search"
                spellCheck={false}
              />
              <span className="palette-hint">
                {IS_MAC ? <Command size={11} strokeWidth={1.5} /> : "Ctrl"}K
              </span>
            </div>
            <ul className="palette-list" ref={listRef} role="listbox">
              {commands.map((c, i) => (
                <li key={c.id}>
                  <button
                    role="option"
                    aria-selected={i === cursor}
                    data-active={i === cursor}
                    className={`palette-item ${i === cursor ? "palette-active" : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => c.run()}
                  >
                    {c.icon}
                    <span className="palette-label">{c.label}</span>
                    {c.hint && <span className="palette-item-hint">{c.hint}</span>}
                  </button>
                </li>
              ))}
              {commands.length === 0 && (
                <li className="palette-empty">Nothing matches — try fewer letters.</li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
