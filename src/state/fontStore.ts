import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import {
  ipc,
  type AppSettings,
  type Classification,
  type FontFace,
  type ScanProgress,
  type TrashEntry,
} from "../lib/ipc";
import { toast } from "../design/primitives/Toast";
import { setSoundLevel, type SoundLevel } from "../lib/sound";
import { applyTheme, type ThemePref } from "../lib/theme";

export const SIZES = [8, 14, 18, 24, 32, 48, 64, 96] as const;

export type ViewMode = "grid" | "list" | "waterfall";
export type MotionPref = "system" | "reduced";
export type SortMode = "name" | "styles" | "size";
export type Nav =
  | { kind: "library" }
  | { kind: "trash" }
  | { kind: "about" }
  | { kind: "tag"; tag: string }
  | { kind: "collection"; name: string }
  | { kind: "favorites" };

export interface Family {
  name: string;
  faces: FontFace[];
  formats: string[];
  isVariable: boolean;
  active: boolean;
  deactivatable: boolean;
  tags: string[];
  totalSize: number;
  foundry: string | null;
  classification: Classification;
  scripts: string[];
}

interface FontStore {
  phase: "scanning" | "ready" | "error";
  scanProgress: ScanProgress;
  fonts: FontFace[];
  tags: Record<string, string[]>;
  collections: Record<string, string[]>;
  favorites: string[];
  notes: Record<string, string>;
  trash: TrashEntry[];
  panelWidth: number;


  selection: string[];

  visibleOrder: string[];

  compare: string[] | null;

  comparePicking: boolean;
  settingsOpen: boolean;
  helpOpen: boolean;
  paletteOpen: boolean;
  settings: AppSettings;
  motionPref: MotionPref;
  soundPref: SoundLevel;
  themePref: ThemePref;

  bulkTagFor: string[] | null;

  onboarded: boolean;

  tourStep: number | null;

  sampleText: string;
  sizeIndex: number;
  viewMode: ViewMode;
  sort: SortMode;
  search: string;

  classFilter: Classification[];

  scriptFilter: string[];
  variableOnly: boolean;
  nav: Nav;
  selectedFamily: string | null;


  pendingCollectionFor: string | null;

  init: () => Promise<void>;
  rescan: () => Promise<void>;
  setFamilyActive: (family: string, active: boolean) => Promise<void>;
  activateFamilySession: (family: string) => Promise<void>;
  installPaths: (paths: string[]) => Promise<void>;
  uninstallFamily: (family: string) => Promise<void>;
  restoreTrash: (entryId: string) => Promise<void>;
  deleteTrashEntry: (entryId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  setFamilyTags: (family: string, tags: string[]) => Promise<void>;
  createCollection: (name: string) => Promise<void>;
  deleteCollection: (name: string) => Promise<void>;
  renameCollection: (from: string, to: string) => Promise<void>;
  toggleFamilyInCollection: (collection: string, family: string) => Promise<void>;
  toggleFavorite: (family: string) => Promise<void>;
  setFamilyNote: (family: string, note: string) => Promise<void>;
  setFamiliesActiveBulk: (families: string[], active: boolean) => Promise<void>;
  setPanelWidth: (w: number) => void;
  selectWith: (family: string, mode: "single" | "toggle" | "range", order: string[]) => void;
  openCompare: (families: string[]) => void;
  closeCompare: () => void;
  setComparePicking: (on: boolean) => void;
  togglePick: (family: string) => void;
  setSettingsOpen: (open: boolean) => void;
  setHelpOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  updateSettings: (settings: AppSettings) => Promise<void>;
  setMotionPref: (pref: MotionPref) => void;
  setSoundPref: (pref: SoundLevel) => void;
  setThemePref: (pref: ThemePref) => void;
  startTour: () => void;
  setTourStep: (step: number) => void;
  endTour: () => void;
  setBulkTagFor: (families: string[] | null) => void;
  applyTagToFamilies: (tag: string, families: string[]) => Promise<void>;

  setSampleText: (t: string) => void;
  setSizeIndex: (i: number) => void;
  setViewMode: (m: ViewMode) => void;
  setSort: (s: SortMode) => void;
  setSearch: (s: string) => void;
  toggleClassFilter: (c: Classification) => void;
  toggleScriptFilter: (s: string) => void;
  setVariableOnly: (on: boolean) => void;
  exportLibraryData: (dest: string) => Promise<void>;
  importLibraryData: (src: string) => Promise<void>;
  setNav: (n: Nav) => void;
  select: (family: string | null) => void;
}

let prefsTimer: ReturnType<typeof setTimeout> | undefined;
function persistPrefs(get: () => FontStore) {
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => {
    const s = get();
    void ipc.setPrefs({
      sampleText: s.sampleText,
      sizeIndex: s.sizeIndex,
      viewMode: s.viewMode,
      sort: s.sort,
      panelWidth: s.panelWidth,
      motionPref: s.motionPref,
      soundPref: s.soundPref,
      themePref: s.themePref,
      onboarded: s.onboarded,
    });
  }, 600);
}

export const useFontStore = create<FontStore>((set, get) => ({
  phase: "scanning",
  scanProgress: { done: 0, total: 0 },
  fonts: [],
  tags: {},
  collections: {},
  favorites: [],
  notes: {},
  trash: [],
  panelWidth: 348,
  selection: [],
  visibleOrder: [],
  compare: null,
  comparePicking: false,
  settingsOpen: false,
  helpOpen: false,
  paletteOpen: false,
  settings: { extraDirs: [], watchEnabled: false },
  motionPref: "system",
  soundPref: "off",
  themePref: "dark",
  bulkTagFor: null,
  onboarded: false,
  tourStep: null,

  sampleText: "The quick brown fox jumps over the lazy dog",
  sizeIndex: 3,
  viewMode: "grid",
  sort: "name",
  search: "",
  classFilter: [],
  scriptFilter: [],
  variableOnly: false,
  nav: { kind: "library" },
  selectedFamily: null,
  pendingCollectionFor: null,

  init: async () => {
    await listen<ScanProgress>("scan:progress", (e) => {
      set({ scanProgress: e.payload });
    });
    try {
      const prefs = (await ipc.getPrefs()) ?? {};
      set({
        sampleText: typeof prefs.sampleText === "string" ? prefs.sampleText : get().sampleText,
        sizeIndex: typeof prefs.sizeIndex === "number" ? prefs.sizeIndex : get().sizeIndex,
        viewMode: (["grid", "list", "waterfall"] as const).includes(
          prefs.viewMode as ViewMode,
        )
          ? (prefs.viewMode as ViewMode)
          : "grid",
        sort: (["name", "styles", "size"] as const).includes(prefs.sort as SortMode)
          ? (prefs.sort as SortMode)
          : "name",
        panelWidth:
          typeof prefs.panelWidth === "number"
            ? Math.min(560, Math.max(300, prefs.panelWidth))
            : 348,
        motionPref: prefs.motionPref === "reduced" ? "reduced" : "system",
        soundPref: (["off", "subtle", "on"] as const).includes(prefs.soundPref as SoundLevel)
          ? (prefs.soundPref as SoundLevel)
          : "off",
        themePref: (["dark", "light", "system"] as const).includes(prefs.themePref as ThemePref)
          ? (prefs.themePref as ThemePref)
          : "dark",
        onboarded: prefs.onboarded === true,
      });
      setSoundLevel(get().soundPref);
    } catch {

    }
    applyTheme(get().themePref);
    try {
      set({ settings: await ipc.getSettings() });
    } catch {

    }


    let watchTimer: ReturnType<typeof setTimeout> | undefined;
    await listen("fonts:changed", () => {
      clearTimeout(watchTimer);
      watchTimer = setTimeout(() => {
        if (get().phase === "scanning") return;
        const before = get().fonts.length;
        void get()
          .rescan()
          .then(() => {
            const after = get().fonts.length;
            if (after !== before) {
              toast.success(
                "Library updated",
                after > before
                  ? `${after - before} new font${after - before === 1 ? "" : "s"} found`
                  : `${before - after} font${before - after === 1 ? "" : "s"} removed`,
              );
            }
          });
      }, 1500);
    });
    await get().rescan();
  },

  rescan: async () => {
    set({ phase: "scanning" });
    try {
      const [fonts, tags, collections, favorites, notes, trash] = await Promise.all([
        ipc.scanFonts(),
        ipc.getTags(),
        ipc.getCollections(),
        ipc.getFavorites(),
        ipc.getNotes(),
        ipc.listTrash(),
      ]);
      set({ fonts, tags, collections, favorites, notes, trash, phase: "ready" });
    } catch (e) {
      set({ phase: "error" });
      toast.error("Couldn't scan your fonts", String(e));
    }
  },

  setFamilyActive: async (family, active) => {
    const faces = get().fonts.filter((f) => f.family === family && f.deactivatable);
    const paths = [...new Set(faces.map((f) => f.path))];
    if (paths.length === 0) return;

    set({
      fonts: get().fonts.map((f) =>
        f.family === family && f.deactivatable ? { ...f, active } : f,
      ),
    });
    try {
      await ipc.setFontsActive(paths, active);
    } catch (e) {
      set({
        fonts: get().fonts.map((f) =>
          f.family === family && f.deactivatable ? { ...f, active: !active } : f,
        ),
      });
      toast.error(active ? "Couldn't activate font" : "Couldn't deactivate font", String(e));
    }
  },

  activateFamilySession: async (family) => {
    const faces = get().fonts.filter((f) => f.family === family && f.deactivatable);
    const paths = [...new Set(faces.map((f) => f.path))];
    if (paths.length === 0) return;
    set({
      fonts: get().fonts.map((f) =>
        f.family === family && f.deactivatable ? { ...f, active: true } : f,
      ),
    });
    try {
      await ipc.setFontsActiveSession(paths);
      toast.success(
        `${family} active until close`,
        "It deactivates itself when you quit ZFontManager",
        "toggle-on",
      );
    } catch (e) {
      set({
        fonts: get().fonts.map((f) =>
          f.family === family && f.deactivatable ? { ...f, active: false } : f,
        ),
      });
      toast.error("Couldn't activate font", String(e));
    }
  },

  installPaths: async (paths) => {
    try {
      const result = await ipc.installFonts(paths);
      if (result.installed.length > 0) {
        set({ fonts: [...get().fonts, ...result.installed] });
        const families = [...new Set(result.installed.map((f) => f.family))];
        toast.success(
          `Installed ${families.length === 1 ? families[0] : `${families.length} font families`}`,
          undefined,
          "install",
        );
      }
      for (const err of result.errors) toast.error("Install failed", err);
      if (result.installed.length === 0 && result.errors.length === 0) {
        toast.error("Nothing to install", "No font files found in the drop");
      }
    } catch (e) {
      toast.error("Install failed", String(e));
    }
  },

  uninstallFamily: async (family) => {
    const faces = get().fonts.filter(
      (f) => f.family === family && f.source !== "system",
    );
    if (faces.length === 0) {
      toast.error("Can't uninstall a system font", "System fonts are protected by the OS");
      return;
    }
    const paths = [...new Set(faces.map((f) => f.path))];
    try {
      const entryIds: string[] = [];
      for (const path of paths) {
        entryIds.push((await ipc.uninstallFont(path, family)).id);
      }
      set({
        fonts: get().fonts.filter((f) => !paths.includes(f.path)),
        trash: await ipc.listTrash(),
        selectedFamily: get().selectedFamily === family ? null : get().selectedFamily,
        selection: get().selection.filter((f) => f !== family),
      });


      const { tags, favorites, collections } = get();
      if (tags[family]) void get().setFamilyTags(family, []);
      if (favorites.includes(family)) void get().toggleFavorite(family);
      for (const [name, members] of Object.entries(collections)) {
        if (members.includes(family)) {
          const next = members.filter((m) => m !== family);
          set({ collections: { ...get().collections, [name]: next } });
          void ipc.setCollection(name, next);
        }
      }
      toast.success(`Moved ${family} to trash`, "Restore it any time from the Trash", "trash", {
        label: "Undo",
        run: () => {
          void (async () => {
            try {
              for (const id of entryIds) await ipc.restoreFromTrash(id);
              set({ trash: await ipc.listTrash() });
              await get().rescan();
              toast.success(`Restored ${family}`, undefined, "restore");
            } catch (e) {
              toast.error("Couldn't restore font", String(e));
            }
          })();
        },
      });
    } catch (e) {
      toast.error("Couldn't move to trash", String(e));
    }
  },

  restoreTrash: async (entryId) => {
    try {
      await ipc.restoreFromTrash(entryId);
      set({ trash: await ipc.listTrash() });
      await get().rescan();
      toast.success("Font restored", undefined, "restore");
    } catch (e) {
      toast.error("Couldn't restore font", String(e));
    }
  },

  deleteTrashEntry: async (entryId) => {
    try {
      await ipc.deleteTrashEntry(entryId);
      set({ trash: await ipc.listTrash() });
    } catch (e) {
      toast.error("Couldn't delete font", String(e));
    }
  },

  emptyTrash: async () => {
    try {
      await ipc.emptyTrash();
      set({ trash: [] });
      toast.success("Trash emptied", undefined, "trash-empty");
    } catch (e) {
      toast.error("Couldn't empty trash", String(e));
    }
  },

  setFamilyTags: async (family, tags) => {
    const prev = get().tags;
    const next = { ...prev };
    if (tags.length === 0) delete next[family];
    else next[family] = tags;
    set({ tags: next });
    try {
      await ipc.setTags(family, tags);
    } catch (e) {
      set({ tags: prev });
      toast.error("Couldn't save tags", String(e));
    }
  },

  createCollection: async (name) => {
    const clean = name.trim();
    if (!clean) return;
    if (get().collections[clean]) {
      toast.error("Collection already exists", `"${clean}" is already in your sidebar`);
      return;
    }
    const prev = get().collections;
    const pending = get().pendingCollectionFor;
    const families = pending ? [pending] : [];
    set({
      collections: { ...prev, [clean]: families },
      pendingCollectionFor: null,
    });
    try {
      await ipc.setCollection(clean, families);
      toast.success(
        `Created "${clean}"`,
        pending ? `${pending} added` : "Right-click any font to add it",
      );
    } catch (e) {
      set({ collections: prev });
      toast.error("Couldn't create collection", String(e));
    }
  },

  deleteCollection: async (name) => {
    const prev = get().collections;
    const next = { ...prev };
    delete next[name];
    const nav = get().nav;
    set({
      collections: next,
      nav: nav.kind === "collection" && nav.name === name ? { kind: "library" } : nav,
    });
    try {
      await ipc.deleteCollection(name);
    } catch (e) {
      set({ collections: prev });
      toast.error("Couldn't delete collection", String(e));
    }
  },

  renameCollection: async (from, to) => {
    const clean = to.trim();
    if (!clean || clean === from) return;
    const prev = get().collections;
    if (prev[clean]) {
      toast.error("Name taken", `"${clean}" already exists`);
      return;
    }
    const next = { ...prev, [clean]: prev[from] ?? [] };
    delete next[from];
    const nav = get().nav;
    set({
      collections: next,
      nav:
        nav.kind === "collection" && nav.name === from
          ? { kind: "collection", name: clean }
          : nav,
    });
    try {
      await ipc.renameCollection(from, clean);
    } catch (e) {
      set({ collections: prev });
      toast.error("Couldn't rename collection", String(e));
    }
  },

  toggleFamilyInCollection: async (collection, family) => {
    const prev = get().collections;
    const current = prev[collection] ?? [];
    const families = current.includes(family)
      ? current.filter((f) => f !== family)
      : [...current, family];
    set({ collections: { ...prev, [collection]: families } });
    try {
      await ipc.setCollection(collection, families);
    } catch (e) {
      set({ collections: prev });
      toast.error("Couldn't update collection", String(e));
    }
  },

  toggleFavorite: async (family) => {
    const prev = get().favorites;
    const favorite = !prev.includes(family);
    set({ favorites: favorite ? [...prev, family] : prev.filter((f) => f !== family) });
    try {
      await ipc.setFavorite(family, favorite);
    } catch (e) {
      set({ favorites: prev });
      toast.error("Couldn't update favorites", String(e));
    }
  },

  setFamilyNote: async (family, note) => {
    const prev = get().notes;
    const next = { ...prev };
    if (note.trim()) next[family] = note;
    else delete next[family];
    set({ notes: next });
    try {
      await ipc.setNote(family, note);
    } catch (e) {
      set({ notes: prev });
      toast.error("Couldn't save note", String(e));
    }
  },

  setFamiliesActiveBulk: async (families, active) => {
    const paths = [
      ...new Set(
        get()
          .fonts.filter((f) => families.includes(f.family) && f.deactivatable)
          .map((f) => f.path),
      ),
    ];
    if (paths.length === 0) return;
    const prevFonts = get().fonts;
    set({
      fonts: prevFonts.map((f) =>
        families.includes(f.family) && f.deactivatable ? { ...f, active } : f,
      ),
    });
    try {
      await ipc.setFontsActive(paths, active);
      toast.success(
        `${active ? "Activated" : "Deactivated"} ${families.length} families`,
        undefined,
        undefined,
        { label: "Undo", run: () => void get().setFamiliesActiveBulk(families, !active) },
      );
    } catch (e) {
      set({ fonts: prevFonts });
      toast.error("Bulk update failed", String(e));
    }
  },

  selectWith: (family, mode, order) => {
    const { selection, selectedFamily } = get();
    if (mode === "toggle") {
      const next = selection.includes(family)
        ? selection.filter((f) => f !== family)
        : [...selection, family];
      set({ selection: next, selectedFamily: family });
      return;
    }
    if (mode === "range" && selectedFamily) {
      const a = order.indexOf(selectedFamily);
      const b = order.indexOf(family);
      if (a !== -1 && b !== -1) {
        const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        set({ selection: [...new Set([...selection, ...range])], selectedFamily: family });
        return;
      }
    }
    set({ selection: [family], selectedFamily: family });
  },

  openCompare: (families) => set({ compare: families.slice(0, 4), comparePicking: false }),
  closeCompare: () => set({ compare: null }),
  setComparePicking: (comparePicking) => set({ comparePicking }),

  togglePick: (family) =>
    set((s) => ({
      selection: s.selection.includes(family)
        ? s.selection.filter((f) => f !== family)
        : [...s.selection, family],
    })),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  updateSettings: async (settings) => {
    const prev = get().settings;
    set({ settings });
    try {
      await ipc.setSettings(settings);
    } catch (e) {
      set({ settings: prev });
      toast.error("Couldn't save settings", String(e));
    }
  },

  setMotionPref: (motionPref) => {
    set({ motionPref });
    persistPrefs(get);
  },

  setSoundPref: (soundPref) => {
    set({ soundPref });
    setSoundLevel(soundPref);
    persistPrefs(get);
  },

  setThemePref: (themePref) => {
    set({ themePref });
    applyTheme(themePref, true);
    persistPrefs(get);
  },

  setBulkTagFor: (bulkTagFor) => set({ bulkTagFor }),

  startTour: () => set({ tourStep: 0 }),
  setTourStep: (tourStep) => set({ tourStep }),
  endTour: () => {
    set({ tourStep: null, onboarded: true, selectedFamily: null, selection: [] });
    persistPrefs(get);
  },

  applyTagToFamilies: async (tag, families) => {
    const clean = tag.trim().toLowerCase();
    if (!clean) return;
    const all = families.every((f) => (get().tags[f] ?? []).includes(clean));
    for (const family of families) {
      const current = get().tags[family] ?? [];
      const next = all
        ? current.filter((t) => t !== clean)
        : current.includes(clean)
          ? current
          : [...current, clean];
      if (next !== current) await get().setFamilyTags(family, next);
    }
  },

  setPanelWidth: (panelWidth) => {
    set({ panelWidth: Math.min(560, Math.max(300, panelWidth)) });
    persistPrefs(get);
  },

  setSampleText: (sampleText) => {
    set({ sampleText });
    persistPrefs(get);
  },
  setSizeIndex: (sizeIndex) => {
    set({ sizeIndex });
    persistPrefs(get);
  },
  setViewMode: (viewMode) => {
    set({ viewMode });
    persistPrefs(get);
  },
  setSort: (sort) => {
    set({ sort });
    persistPrefs(get);
  },
  setSearch: (search) => set({ search }),
  toggleClassFilter: (c) => {
    const cur = get().classFilter;
    set({ classFilter: cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c] });
  },
  toggleScriptFilter: (s) => {
    const cur = get().scriptFilter;
    set({ scriptFilter: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] });
  },
  setVariableOnly: (variableOnly) => set({ variableOnly }),

  exportLibraryData: async (dest) => {
    const { tags, collections, favorites, notes } = get();
    const payload = {
      app: "ZFontManager",
      version: 1,
      exportedAt: new Date().toISOString(),
      tags,
      collections,
      favorites,
      notes,
    };
    try {
      await ipc.writeTextFile(dest, JSON.stringify(payload, null, 2));
      toast.success("Library data exported", dest, "install");
    } catch (e) {
      toast.error("Export failed", String(e));
    }
  },


  importLibraryData: async (src) => {
    try {
      const raw: unknown = JSON.parse(await ipc.readTextFile(src));
      const d = raw as Partial<{
        app: string;
        tags: Record<string, string[]>;
        collections: Record<string, string[]>;
        favorites: string[];
        notes: Record<string, string>;
      }>;
      if (d?.app !== "ZFontManager") {
        toast.error("Not a ZFontManager export", "Pick a file created by Export library data");
        return;
      }
      let touched = 0;
      const state = get();
      if (d.tags) {
        for (const [family, list] of Object.entries(d.tags)) {
          if (!Array.isArray(list)) continue;
          const existing = state.tags[family] ?? [];
          const merged = [...new Set([...existing, ...list.map(String)])];
          if (merged.length === existing.length) continue;
          await get().setFamilyTags(family, merged);
          touched++;
        }
      }
      if (d.collections) {
        for (const [name, members] of Object.entries(d.collections)) {
          if (!Array.isArray(members)) continue;
          const existing = get().collections[name];
          const merged = [...new Set([...(existing ?? []), ...members.map(String)])];
          if (existing && merged.length === existing.length) continue;
          set({ collections: { ...get().collections, [name]: merged } });
          await ipc.setCollection(name, merged);
          touched++;
        }
      }
      if (Array.isArray(d.favorites)) {
        for (const family of d.favorites.map(String)) {
          if (!get().favorites.includes(family)) {
            set({ favorites: [...get().favorites, family] });
            await ipc.setFavorite(family, true);
            touched++;
          }
        }
      }
      if (d.notes) {
        for (const [family, note] of Object.entries(d.notes)) {
          if (typeof note !== "string" || get().notes[family]) continue;
          await get().setFamilyNote(family, note);
          touched++;
        }
      }
      toast.success(
        "Library data imported",
        `${touched} ${touched === 1 ? "entry" : "entries"} merged in`,
        "restore",
      );
    } catch (e) {
      toast.error("Import failed", String(e));
    }
  },
  setNav: (nav) => set({ nav, selectedFamily: null, selection: [] }),
  select: (selectedFamily) =>
    set({ selectedFamily, selection: selectedFamily ? [selectedFamily] : [] }),
}));

const styleOrder = (f: FontFace) => f.weight * 2 + (f.italic ? 1 : 0);

export function computeFamilies(
  fonts: FontFace[],
  tags: Record<string, string[]>,
): Map<string, Family> {
  const map = new Map<string, Family>();
  for (const f of fonts) {
    let fam = map.get(f.family);
    if (!fam) {
      fam = {
        name: f.family,
        faces: [],
        formats: [],
        isVariable: false,
        active: false,
        deactivatable: false,
        tags: tags[f.family] ?? [],
        totalSize: 0,
        foundry: null,
        classification: "unknown",
        scripts: [],
      };
      map.set(f.family, fam);
    }
    fam.faces.push(f);
    if (!fam.formats.includes(f.format)) fam.formats.push(f.format);
    fam.isVariable ||= f.isVariable;
    fam.foundry ??= f.foundry;


    if (fam.classification === "unknown") fam.classification = f.classification;
    for (const s of f.scripts ?? []) {
      if (!fam.scripts.includes(s)) fam.scripts.push(s);
    }
    fam.active ||= f.active;
    fam.deactivatable ||= f.deactivatable;
    fam.totalSize += f.fileSize;
  }
  for (const fam of map.values()) {
    fam.faces.sort((a, b) => styleOrder(a) - styleOrder(b));
  }
  return map;
}

export function selectVisibleFamilies(s: {
  fonts: FontFace[];
  tags: Record<string, string[]>;
  collections: Record<string, string[]>;
  favorites: string[];
  notes: Record<string, string>;
  search: string;
  classFilter: Classification[];
  scriptFilter: string[];
  variableOnly: boolean;
  nav: Nav;
  sort: SortMode;
}): Family[] {
  const families = [...familiesFor(s.fonts, s.tags).values()];
  const q = s.search.trim().toLowerCase();
  let out = families;
  if (s.classFilter.length > 0) {
    out = out.filter((f) => s.classFilter.includes(f.classification));
  }
  if (s.scriptFilter.length > 0) {
    out = out.filter((f) => s.scriptFilter.every((sc) => f.scripts.includes(sc)));
  }
  if (s.variableOnly) {
    out = out.filter((f) => f.isVariable);
  }
  if (s.nav.kind === "tag") {
    const tag = s.nav.tag;
    out = out.filter((f) => f.tags.includes(tag));
  }
  if (s.nav.kind === "collection") {
    const members = s.collections[s.nav.name] ?? [];
    out = out.filter((f) => members.includes(f.name));
  }
  if (s.nav.kind === "favorites") {
    out = out.filter((f) => s.favorites.includes(f.name));
  }
  if (q) {
    out = out.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q)) ||
        f.formats.some((fmt) => fmt.includes(q)) ||
        (f.foundry?.toLowerCase().includes(q) ?? false) ||
        (s.notes[f.name]?.toLowerCase().includes(q) ?? false),
    );
  }
  switch (s.sort) {
    case "styles":
      out.sort((a, b) => b.faces.length - a.faces.length || a.name.localeCompare(b.name));
      break;
    case "size":
      out.sort((a, b) => b.totalSize - a.totalSize || a.name.localeCompare(b.name));
      break;
    default:
      out.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}

export function allTags(tags: Record<string, string[]>): Map<string, number> {
  const m = new Map<string, number>();
  for (const list of Object.values(tags)) {
    for (const t of list) m.set(t, (m.get(t) ?? 0) + 1);
  }
  return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

export interface FontConflict {
  key: string;
  paths: string[];
}


const familyCache = new WeakMap<FontFace[], WeakMap<object, Map<string, Family>>>();


export function familiesFor(
  fonts: FontFace[],
  tags: Record<string, string[]>,
): Map<string, Family> {
  let byTags = familyCache.get(fonts);
  if (!byTags) {
    byTags = new WeakMap();
    familyCache.set(fonts, byTags);
  }
  let result = byTags.get(tags);
  if (!result) {
    result = computeFamilies(fonts, tags);
    byTags.set(tags, result);
  }
  return result;
}

const conflictCache = new WeakMap<FontFace[], Map<string, FontConflict[]>>();


export function conflictsFor(fonts: FontFace[]): Map<string, FontConflict[]> {
  let cached = conflictCache.get(fonts);
  if (!cached) {
    cached = computeConflicts(fonts);
    conflictCache.set(fonts, cached);
  }
  return cached;
}

export function computeConflicts(fonts: FontFace[]): Map<string, FontConflict[]> {
  const byKey = new Map<string, { paths: Set<string>; families: Set<string> }>();
  for (const f of fonts) {
    const key = f.postscriptName ?? `${f.family} ${f.style}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { paths: new Set(), families: new Set() };
      byKey.set(key, entry);
    }
    entry.paths.add(f.path);
    entry.families.add(f.family);
  }
  const out = new Map<string, FontConflict[]>();
  for (const [key, { paths, families }] of byKey) {
    if (paths.size < 2) continue;
    for (const fam of families) {
      const list = out.get(fam) ?? [];
      list.push({ key, paths: [...paths] });
      out.set(fam, list);
    }
  }
  return out;
}

