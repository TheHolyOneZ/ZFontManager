import { getCurrentWindow } from "@tauri-apps/api/window";
import { MotionConfig, motion } from "motion/react";
import { Clock, FolderOpen, History, Monitor, Power, PowerOff, SearchX, Star, Tag as TagIcon, Type } from "lucide-react";
import { useEffect, useMemo } from "react";
import { DetailPanel } from "./components/DetailPanel";
import { ResizeGrips } from "./components/ResizeGrips";
import { Titlebar } from "./components/Titlebar";
import { DropZone } from "./components/DropZone";
import { FontGrid } from "./components/FontGrid";
import { FontList } from "./components/FontList";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { TrashView } from "./components/TrashView";
import { OnlineView } from "./components/OnlineView";
import { AboutView } from "./components/AboutView";
import { WaterfallView } from "./components/WaterfallView";
import { CompareOverlay } from "./components/CompareOverlay";
import { SelectionBar } from "./components/SelectionBar";
import { SettingsOverlay } from "./components/SettingsOverlay";
import { ShortcutsOverlay } from "./components/ShortcutsOverlay";
import { CommandPalette } from "./components/CommandPalette";
import { BulkTagPrompt } from "./components/BulkTagPrompt";
import { DuplicateDialog } from "./components/DuplicateDialog";
import { Onboarding } from "./components/Onboarding";
import { ContextMenuHost, openContextMenuAt } from "./design/primitives/ContextMenu";
import { buildFamilyMenu } from "./lib/menus";
import { Toaster } from "./design/primitives/Toast";
import { spring } from "./design/springs";
import { familiesFor, selectVisibleFamilies, useFontStore, type Nav } from "./state/fontStore";
import { useT } from "./lib/i18n";

function ScanSkeleton() {
  const t = useT();
  const { done, total } = useFontStore((s) => s.scanProgress);
  return (
    <div className="scan-skeleton">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton skeleton-card" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
      <div className="scan-progress tabular">
        {total > 0 ? t("scan.reading", { done, total }) : t("scan.finding")}
      </div>
    </div>
  );
}

function EmptyLibrary({ searching, nav }: { searching: boolean; nav: Nav }) {
  const t = useT();

  let icon = <Type size={26} strokeWidth={1.5} />;
  let title = t("empty.library.title");
  let hint = t("empty.library.body");
  if (searching) {
    icon = <SearchX size={26} strokeWidth={1.5} />;
    title = t("empty.search.title");
    hint = t("empty.search.body");
  } else if (nav.kind === "favorites") {
    icon = <Star size={26} strokeWidth={1.5} />;
    title = t("empty.favorites.title");
    hint = t("empty.favorites.body");
  } else if (nav.kind === "lastImported") {
    icon = <History size={26} strokeWidth={1.5} />;
    title = t("empty.lastImported.title");
    hint = t("empty.lastImported.body");
  } else if (nav.kind === "collection") {
    icon = <FolderOpen size={26} strokeWidth={1.5} />;
    title = t("empty.collection.title");
    hint = t("empty.collection.body", { name: nav.name });
  } else if (nav.kind === "tag") {
    icon = <TagIcon size={26} strokeWidth={1.5} />;
    title = t("empty.tag.title");
    hint = t("empty.tag.body");
  } else if (nav.kind === "activated") {
    icon = <Power size={26} strokeWidth={1.5} />;
    title = t("empty.activated.title");
    hint = t("empty.activated.body");
  } else if (nav.kind === "activatedSession") {
    icon = <Clock size={26} strokeWidth={1.5} />;
    title = t("empty.session.title");
    hint = t("empty.session.body");
  } else if (nav.kind === "deactivated") {
    icon = <PowerOff size={26} strokeWidth={1.5} />;
    title = t("empty.deactivated.title");
    hint = t("empty.deactivated.body");
  } else if (nav.kind === "system") {
    icon = <Monitor size={26} strokeWidth={1.5} />;
    title = t("empty.system.title");
    hint = t("empty.system.body");
  }
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <span className="empty-tile">{icon}</span>
      <h2>{title}</h2>
      <p>{hint}</p>
    </motion.div>
  );
}

function MainContent() {
  const phase = useFontStore((s) => s.phase);
  const nav = useFontStore((s) => s.nav);
  const viewMode = useFontStore((s) => s.viewMode);
  const fonts = useFontStore((s) => s.fonts);
  const tags = useFontStore((s) => s.tags);
  const collections = useFontStore((s) => s.collections);
  const favorites = useFontStore((s) => s.favorites);
  const sessionActivated = useFontStore((s) => s.sessionActivated);
  const lastImported = useFontStore((s) => s.lastImported);
  const notes = useFontStore((s) => s.notes);
  const search = useFontStore((s) => s.search);
  const classFilter = useFontStore((s) => s.classFilter);
  const scriptFilter = useFontStore((s) => s.scriptFilter);
  const variableOnly = useFontStore((s) => s.variableOnly);
  const toggleableOnly = useFontStore((s) => s.toggleableOnly);
  const formatFilter = useFontStore((s) => s.formatFilter);
  const featureFilter = useFontStore((s) => s.featureFilter);
  const charFilter = useFontStore((s) => s.charFilter);
  const charMatches = useFontStore((s) => s.charMatches);
  const sort = useFontStore((s) => s.sort);

  const families = useMemo(
    () =>
      selectVisibleFamilies({
        fonts, tags, collections, favorites, sessionActivated, lastImported, notes, search,
        classFilter, scriptFilter, formatFilter, featureFilter, charFilter, charMatches,
        variableOnly, toggleableOnly, nav, sort,
      }),
    [fonts, tags, collections, favorites, sessionActivated, lastImported, notes, search, classFilter, scriptFilter, formatFilter, featureFilter, charFilter, charMatches, variableOnly, toggleableOnly, nav, sort],
  );

  useEffect(() => {
    useFontStore.setState({ visibleOrder: families.map((f) => f.name) });
  }, [families]);

  if (nav.kind === "trash") return <TrashView />;
  if (nav.kind === "about") return <AboutView />;
  if (nav.kind === "online") return <OnlineView />;
  if (phase === "scanning") return <ScanSkeleton />;
  if (families.length === 0)
    return (
      <EmptyLibrary
        nav={nav}
        searching={
          search.trim().length > 0 ||
          classFilter.length > 0 ||
          scriptFilter.length > 0 ||
          formatFilter.length > 0 ||
          featureFilter.length > 0 ||
          charFilter.length > 0 ||
          variableOnly ||
          toggleableOnly
        }
      />
    );
  if (viewMode === "waterfall") return <WaterfallView families={families} />;
  return viewMode === "grid" ? (
    <FontGrid families={families} />
  ) : (
    <FontList families={families} />
  );
}

export default function App() {
  const init = useFontStore((s) => s.init);
  const motionPref = useFontStore((s) => s.motionPref);

  useEffect(() => {
    void init();

    void getCurrentWindow().show();
  }, [init]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Escape" && !inField) {
        const st = useFontStore.getState();
        st.setComparePicking(false);
        st.select(null);
      }
      if (e.key === "/" && !inField) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (e.key === "?" && !inField) {
        e.preventDefault();
        const st = useFontStore.getState();
        st.setHelpOpen(!st.helpOpen);
      }

      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const st = useFontStore.getState();
        st.setPaletteOpen(!st.paletteOpen);
      }

      if ((e.key === "a" || e.key === "A") && (e.metaKey || e.ctrlKey) && !inField) {
        const st = useFontStore.getState();
        if (st.compare || st.settingsOpen || st.helpOpen || st.paletteOpen) return;
        e.preventDefault();
        st.selectAll();
      }

      const arrows = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"];
      if (arrows.includes(e.key) && !inField) {
        const st = useFontStore.getState();
        if (st.compare || st.settingsOpen || st.helpOpen) return;
        const order = st.visibleOrder;
        if (order.length === 0) return;
        e.preventDefault();
        const cur = st.selectedFamily ? order.indexOf(st.selectedFamily) : -1;
        const next =
          e.key === "Home" ? 0
          : e.key === "End" ? order.length - 1
          : e.key === "ArrowDown" || e.key === "ArrowRight"
            ? Math.min(cur + 1, order.length - 1)
            : Math.max(cur - 1, 0);
        st.selectWith(order[next], e.shiftKey ? "range" : "single", order);
      }
      if (e.key === " " && !inField) {
        const st = useFontStore.getState();
        if (st.compare || st.settingsOpen || st.helpOpen || !st.selectedFamily) return;
        e.preventDefault();
        const fam = familiesFor(st.fonts, st.tags).get(st.selectedFamily);
        if (fam?.deactivatable) {
          void st.setFamilyActive(fam.name, !fam.active);
        }
      }

      if ((e.key === "c" || e.key === "C") && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const st = useFontStore.getState();
        if (st.compare || st.settingsOpen || st.helpOpen || st.selection.length < 2) return;
        e.preventDefault();
        st.openCompare(st.selection);
      }

      if ((e.key === "f" || e.key === "F") && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const st = useFontStore.getState();
        if (st.compare || st.settingsOpen || st.helpOpen || !st.selectedFamily) return;
        e.preventDefault();
        void st.toggleFavorite(st.selectedFamily);
      }
      if (e.key === "Delete" && !inField) {
        const st = useFontStore.getState();
        if (st.compare || st.settingsOpen || st.helpOpen) return;
        const doomed = st.selection.length > 0
          ? st.selection
          : st.selectedFamily ? [st.selectedFamily] : [];
        if (doomed.length === 0) return;
        e.preventDefault();
        for (const name of doomed) void st.uninstallFamily(name);
      }

      if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
        const st = useFontStore.getState();
        if (inField || st.compare || st.settingsOpen || st.helpOpen || !st.selectedFamily) return;
        e.preventDefault();
        const fam = familiesFor(st.fonts, st.tags).get(st.selectedFamily);
        if (!fam) return;
        const card = document.querySelector(`[data-family="${CSS.escape(fam.name)}"]`);
        const r = card?.getBoundingClientRect();
        openContextMenuAt(
          r ? r.left + Math.min(r.width / 2, 240) : window.innerWidth / 2,
          r ? Math.min(r.top + 40, window.innerHeight - 80) : window.innerHeight / 2,
          buildFamilyMenu(fam),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion={motionPref === "reduced" ? "always" : "user"}>
      <div className="app-frame">
        <Titlebar />
        <div className="app-shell">
          <Sidebar />
          <div className="app-main">
            <TopBar />
            <main className="app-content">
              <MainContent />
            </main>
          </div>
          <DetailPanel />
        </div>
      </div>
      <DropZone />
      <SelectionBar />
      <CompareOverlay />
      <SettingsOverlay />
      <ShortcutsOverlay />
      <CommandPalette />
      <BulkTagPrompt />
      <Onboarding />
      <ContextMenuHost />
      <DuplicateDialog />
      <Toaster />
      <ResizeGrips />
    </MotionConfig>
  );
}
