import { motion } from "motion/react";
import { ChevronDown, Clock, Download, EyeOff, FileText, Folder, FolderOpen, FolderPlus, FolderTree, Globe, Pencil, History, Info, Keyboard, Library, Monitor, PanelLeft, Plus, Power, PowerOff, Star, Tag, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { openContextMenu } from "../design/primitives/ContextMenu";
import { spring, springSoft, staggerDelay } from "../design/springs";
import { allTags, familiesFor, useFontStore, type Family, type Nav } from "../state/fontStore";
import { mergeOrder, SIDEBAR_DEFAULT_WIDTH } from "../lib/sidebarLayout";
import { useReorder } from "../lib/useReorder";
import { exportCollection, exportFontList } from "../lib/menus";
import { folderGroups, folderLabel, inFolder } from "../lib/folders";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast } from "../design/primitives/Toast";
import { t as translate, useT, type TKey } from "../lib/i18n";

function navKey(n: Nav): string {
  if (n.kind === "tag") return `tag:${n.tag}`;
  if (n.kind === "collection") return `col:${n.name}`;
  if (n.kind === "favorites") return "favorites";
  if (n.kind === "folder") return `dir:${n.path}`;
  return n.kind;
}

function NavRow({
  nav,
  icon,
  label,
  count,
  index,
  title,
  onContextMenu,
}: {
  nav: Nav;
  icon: React.ReactNode;
  label: string;
  count?: number;
  index: number;
  title?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const current = useFontStore((s) => s.nav);
  const setNav = useFontStore((s) => s.setNav);
  const active = navKey(current) === navKey(nav);
  return (
    <motion.button
      className={`nav-row ${active ? "nav-active" : ""}`}
      onClick={() => setNav(nav)}
      onContextMenu={onContextMenu}
      title={title ?? label}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springSoft, delay: staggerDelay(index) }}
      whileTap={{ scale: 0.97 }}
    >
      {active && (
        <motion.span className="nav-pill" layoutId="nav-pill" transition={spring} />
      )}
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {count !== undefined && <span className="nav-count tabular">{count}</span>}
    </motion.button>
  );
}

function NewCollectionInput({ initial, onDone }: { initial: string; onDone: () => void }) {
  const t = useT();
  const createCollection = useFontStore((s) => s.createCollection);
  const [name, setName] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = () => {
    if (name.trim()) void createCollection(name);
    onDone();
  };

  return (
    <motion.div
      className="collection-input"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <FolderOpen size={15} strokeWidth={1.5} />
      <input
        ref={ref}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") onDone();
        }}
        onBlur={commit}
        placeholder={t("side.collectionPlaceholder")}
        aria-label={t("side.newCollectionAria")}
        spellCheck={false}
      />
    </motion.div>
  );
}

function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <div className="collection-input">
      <FolderOpen size={15} strokeWidth={1.5} />
      <input
        ref={ref}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit(name);
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => onCommit(name)}
        aria-label={t("side.renameAria")}
        spellCheck={false}
      />
    </div>
  );
}

export const SIDEBAR_LABELS: Record<string, TKey> = {
  library: "side.library",
  favorites: "side.favorites",
  lastImported: "side.lastImported",
  activated: "side.activated",
  activatedSession: "side.activatedUntilClose",
  deactivated: "side.deactivated",
  system: "side.system",
  collections: "side.collections",
  tags: "side.tags",
  folders: "side.watchedFolders",
  online: "side.online",
  trash: "side.trash",
  about: "side.about",
  shortcuts: "side.shortcuts",
};

export const SIDEBAR_ICONS: Record<string, ReactNode> = {
  library: <Library size={15} strokeWidth={1.5} />,
  favorites: <Star size={15} strokeWidth={1.5} />,
  lastImported: <History size={15} strokeWidth={1.5} />,
  activated: <Power size={15} strokeWidth={1.5} />,
  activatedSession: <Clock size={15} strokeWidth={1.5} />,
  deactivated: <PowerOff size={15} strokeWidth={1.5} />,
  system: <Monitor size={15} strokeWidth={1.5} />,
  collections: <FolderOpen size={15} strokeWidth={1.5} />,
  tags: <Tag size={15} strokeWidth={1.5} />,
  folders: <Folder size={15} strokeWidth={1.5} />,
  online: <Globe size={15} strokeWidth={1.5} />,
  trash: <Trash2 size={15} strokeWidth={1.5} />,
  about: <Info size={15} strokeWidth={1.5} />,
  shortcuts: <Keyboard size={15} strokeWidth={1.5} />,
};

function hideMenu(id: string) {
  return [
    {
      label: translate("side.hideItem", { name: translate(SIDEBAR_LABELS[id]) }),
      icon: <EyeOff size={14} strokeWidth={1.5} />,
      action: () => useFontStore.getState().setSidebarHidden(id, true),
    },
    {
      label: translate("side.customize"),
      icon: <PanelLeft size={14} strokeWidth={1.5} />,
      action: () => useFontStore.getState().setSettingsOpen(true, "sidebar"),
    },
  ];
}

function SidebarResizer() {
  const t = useT();
  const setSidebarWidth = useFontStore((s) => s.setSidebarWidth);
  const [active, setActive] = useState(false);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const aside = (e.currentTarget as HTMLElement).parentElement;
      const left = aside?.getBoundingClientRect().left ?? 0;
      setActive(true);
      document.documentElement.classList.add("is-col-resizing");
      const onMove = (ev: PointerEvent) => setSidebarWidth(ev.clientX - left);
      const onUp = () => {
        setActive(false);
        document.documentElement.classList.remove("is-col-resizing");
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setSidebarWidth],
  );

  return (
    <div
      className={`sidebar-resize ${active ? "is-active" : ""}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={t("side.resize")}
      title={t("side.resizeHint")}
      data-tour="sidebar-edge"
      onPointerDown={onDown}
      onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
    />
  );
}

export function Sidebar() {
  const t = useT();
  const fonts = useFontStore((s) => s.fonts);
  const tags = useFontStore((s) => s.tags);
  const collections = useFontStore((s) => s.collections);
  const favorites = useFontStore((s) => s.favorites);
  const lastImported = useFontStore((s) => s.lastImported);
  const trash = useFontStore((s) => s.trash);
  const onlineEnabled = useFontStore((s) => s.settings.onlineFontsEnabled);
  const deleteCollection = useFontStore((s) => s.deleteCollection);
  const renameCollection = useFontStore((s) => s.renameCollection);
  const setFamilyTags = useFontStore((s) => s.setFamilyTags);
  const pendingCollectionFor = useFontStore((s) => s.pendingCollectionFor);
  const extraDirs = useFontStore((s) => s.settings.extraDirs);
  const nav = useFontStore((s) => s.nav);
  const setNav = useFontStore((s) => s.setNav);
  const sidebarWidth = useFontStore((s) => s.sidebarWidth);
  const sidebarOrder = useFontStore((s) => s.sidebarOrder);
  const sectionOrder = useFontStore((s) => s.sectionOrder);
  const hidden = useFontStore((s) => s.sidebarHidden);
  const setSidebarOrder = useFontStore((s) => s.setSidebarOrder);
  const setSectionOrder = useFontStore((s) => s.setSectionOrder);
  const browseRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (nav.kind === "folder" && !extraDirs.includes(nav.path)) setNav({ kind: "library" });
  }, [nav, extraDirs, setNav]);

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingCollectionFor) return;
    setCreating(true);
    const st = useFontStore.getState();
    if (st.collapsedSections.includes("collections")) st.toggleSection("collections");
    if (st.sidebarHidden.includes("collections")) st.setSidebarHidden("collections", false);
  }, [pendingCollectionFor]);

  const familyCount = familiesFor(fonts, tags).size;
  const sessionActivated = useFontStore((s) => s.sessionActivated);
  const allFamilies = [...familiesFor(fonts, tags).values()];
  const activatedCount = allFamilies.filter(
    (f) => (f.active || f.partial) && !sessionActivated.includes(f.name),
  ).length;
  const sessionCount = allFamilies.filter((f) =>
    sessionActivated.includes(f.name),
  ).length;
  const deactivatedCount = allFamilies.filter((f) => !f.active && !f.webOnly).length;
  const systemCount = allFamilies.filter(
    (f) => f.faces.length > 0 && f.faces.every((face) => face.source === "system"),
  ).length;
  const tagCounts = allTags(tags);
  const folderCounts = new Map(
    extraDirs.map((dir) => [
      dir,
      allFamilies.filter((f) => f.faces.some((face) => inFolder(face.path, dir))).length,
    ]),
  );
  const collapsed = useFontStore((s) => s.collapsedSections);
  const toggleSection = useFontStore((s) => s.toggleSection);
  const collectionNames = Object.keys(collections).sort((a, b) => a.localeCompare(b));

  const browseCounts: Record<string, number> = {
    library: familyCount,
    favorites: favorites.length,
    lastImported: lastImported.length,
    activated: activatedCount,
    activatedSession: sessionCount,
    deactivated: deactivatedCount,
    system: systemCount,
  };
  const browseNav: Record<string, Nav> = {
    library: { kind: "library" },
    favorites: { kind: "favorites" },
    lastImported: { kind: "lastImported" },
    activated: { kind: "activated" },
    activatedSession: { kind: "activatedSession" },
    deactivated: { kind: "deactivated" },
    system: { kind: "system" },
  };

  const browseIds = sidebarOrder.filter((id) => !hidden.includes(id));
  const sectionIds = sectionOrder.filter(
    (id) =>
      !hidden.includes(id) &&
      (id !== "tags" || tagCounts.size > 0) &&
      (id !== "folders" || extraDirs.length > 0),
  );

  useReorder(browseRef, browseIds, (next) => setSidebarOrder(mergeOrder(sidebarOrder, next)), {
    enabled: !collapsed.includes("browse"),
    onDragState: setDragging,
  });
  useReorder(sectionsRef, sectionIds, (next) => setSectionOrder(mergeOrder(sectionOrder, next)), {
    handle: ".sidebar-heading-row",
    onDragState: setDragging,
  });

  const removeTagEverywhere = (tag: string) => {
    for (const [family, list] of Object.entries(tags)) {
      if (list.includes(tag)) {
        void setFamilyTags(family, list.filter((t) => t !== tag));
      }
    }
  };

  let i = 0;

  const heading = (id: string, label: string, extra?: ReactNode) => (
    <div
      className="sidebar-heading sidebar-heading-row"
      onContextMenu={(e) => openContextMenu(e, hideMenu(id))}
    >
      <button
        className="sidebar-toggle"
        onClick={() => toggleSection(id)}
        aria-expanded={!collapsed.includes(id)}
      >
        <span className="sidebar-chevron">
          <ChevronDown size={12} strokeWidth={2} />
        </span>
        <span>{label}</span>
      </button>
      {extra}
    </div>
  );

  const sections: Record<string, () => ReactNode> = {
    collections: () => (
      <div
        key="collections"
        data-reorder-id="collections"
        data-tour="collections"
        className={`sidebar-section ${collapsed.includes("collections") ? "sidebar-collapsed" : ""}`}
      >
        {heading(
          "collections",
          t("side.collections"),
          <motion.button
            className="sidebar-add"
            aria-label={t("side.newCollection")}
            onClick={() => setCreating(true)}
            whileTap={{ scale: 0.9 }}
          >
            <Plus size={13} strokeWidth={2} />
          </motion.button>,
        )}
        {creating && (
          <NewCollectionInput
            key={pendingCollectionFor?.name ?? ""}
            initial={pendingCollectionFor?.name ?? ""}
            onDone={() => {
              setCreating(false);
              useFontStore.setState({ pendingCollectionFor: null });
            }}
          />
        )}
        {!collapsed.includes("collections") &&
          collectionNames.map((name) =>
            renaming === name ? (
              <RenameInput
                key={name}
                initial={name}
                onCommit={(next) => {
                  setRenaming(null);
                  void renameCollection(name, next);
                }}
                onCancel={() => setRenaming(null)}
              />
            ) : (
              <NavRow
                key={name}
                nav={{ kind: "collection", name }}
                icon={<FolderOpen size={15} strokeWidth={1.5} />}
                label={name}
                count={(collections[name] ?? []).length}
                index={i++}
                onContextMenu={(e) =>
                  openContextMenu(e, [
                    {
                      label: translate("menu.rename"),
                      icon: <Pencil size={14} strokeWidth={1.5} />,
                      action: () => setRenaming(name),
                    },
                    {
                      label: translate("menu.exportCollection"),
                      icon: <Download size={14} strokeWidth={1.5} />,
                      disabled: (collections[name] ?? []).length === 0,
                      action: () => void exportCollection(name),
                    },
                    {
                      label: translate("menu.exportFontList"),
                      icon: <FileText size={14} strokeWidth={1.5} />,
                      action: () => {
                        const map = familiesFor(fonts, tags);
                        const fams = (collections[name] ?? [])
                          .map((n) => map.get(n))
                          .filter((f): f is Family => Boolean(f));
                        void exportFontList(fams, name);
                      },
                    },
                    { kind: "separator" },
                    {
                      label: translate("menu.deleteCollection"),
                      icon: <Trash2 size={14} strokeWidth={1.5} />,
                      danger: true,
                      action: () => void deleteCollection(name),
                    },
                  ])
                }
              />
            ),
          )}
        {!collapsed.includes("collections") && collectionNames.length === 0 && !creating && (
          <button className="sidebar-hint" onClick={() => setCreating(true)}>
            {t("side.firstCollection")}
          </button>
        )}
      </div>
    ),
    tags: () => (
      <div
        key="tags"
        data-reorder-id="tags"
        className={`sidebar-section ${collapsed.includes("tags") ? "sidebar-collapsed" : ""}`}
      >
        {heading("tags", t("side.tags"))}
        {!collapsed.includes("tags") &&
          [...tagCounts.entries()].map(([tag, count]) => (
            <NavRow
              key={tag}
              nav={{ kind: "tag", tag }}
              icon={<Tag size={15} strokeWidth={1.5} />}
              label={tag}
              count={count}
              index={i++}
              onContextMenu={(e) =>
                openContextMenu(e, [
                  {
                    label: translate("menu.removeTagEverywhere", { tag }),
                    danger: true,
                    action: () => removeTagEverywhere(tag),
                  },
                ])
              }
            />
          ))}
      </div>
    ),
    folders: () => (
      <div
        key="folders"
        data-reorder-id="folders"
        className={`sidebar-section ${collapsed.includes("folders") ? "sidebar-collapsed" : ""}`}
      >
        {heading("folders", t("side.watchedFolders"))}
        {!collapsed.includes("folders") &&
          extraDirs.map((dir) => (
            <NavRow
              key={dir}
              nav={{ kind: "folder", path: dir }}
              icon={<Folder size={15} strokeWidth={1.5} />}
              label={folderLabel(dir)}
              title={dir}
              count={folderCounts.get(dir) ?? 0}
              index={i++}
              onContextMenu={(e) => {
                const inside = allFamilies.filter((f) =>
                  f.faces.some((face) => inFolder(face.path, dir)),
                );
                const names = inside.map((f) => f.name);
                const subfolders = folderGroups(inside, dir, true).size;
                openContextMenu(e, [
                  {
                    label: translate("menu.showInFileManager"),
                    icon: <FolderOpen size={14} strokeWidth={1.5} />,
                    action: () =>
                      revealItemInDir(dir).catch((err) =>
                        toast.error(translate("toast.couldntOpenFileManager"), String(err)),
                      ),
                  },
                  { kind: "separator" },
                  {
                    label: translate("menu.collectFolder", { name: folderLabel(dir) }),
                    icon: <FolderPlus size={14} strokeWidth={1.5} />,
                    disabled: names.length === 0,
                    action: () => void useFontStore.getState().collectFolder(dir, false),
                  },
                  {
                    label: translate("menu.collectSubfolders", { count: subfolders }),
                    icon: <FolderTree size={14} strokeWidth={1.5} />,
                    disabled: subfolders === 0,
                    action: () => void useFontStore.getState().collectFolder(dir, true),
                  },
                  ...(collectionNames.length > 0 && names.length > 0
                    ? [
                        { kind: "heading", label: translate("menu.addAllToCollection") } as const,
                        ...collectionNames.map((name) => ({
                          kind: "check" as const,
                          label: name,
                          checked: names.every((f) => (collections[name] ?? []).includes(f)),
                          action: () =>
                            void useFontStore.getState().toggleFamiliesInCollection(name, names),
                        })),
                      ]
                    : []),
                ]);
              }}
            />
          ))}
      </div>
    ),
  };

  const footerShown = (id: string) => !hidden.includes(id);

  return (
    <motion.aside
      className={`sidebar ${dragging ? "sidebar-dragging" : ""}`}
      style={{ width: sidebarWidth }}
      initial={{ x: -48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={springSoft}
    >
      <div className="sidebar-scroll">
        {browseIds.length > 0 && (
          <div className={`sidebar-section ${collapsed.includes("browse") ? "sidebar-collapsed" : ""}`}>
            <div className="sidebar-heading sidebar-heading-row">
              <button
                className="sidebar-toggle"
                onClick={() => toggleSection("browse")}
                aria-expanded={!collapsed.includes("browse")}
              >
                <span className="sidebar-chevron">
                  <ChevronDown size={12} strokeWidth={2} />
                </span>
                <span>{t("side.browse")}</span>
              </button>
            </div>
            {!collapsed.includes("browse") && (
              <div ref={browseRef} className="sidebar-reorder" data-tour="browse">
                {browseIds.map((id) => (
                  <div key={id} data-reorder-id={id} className="nav-slot">
                    <NavRow
                      nav={browseNav[id]}
                      icon={SIDEBAR_ICONS[id]}
                      label={t(SIDEBAR_LABELS[id])}
                      count={browseCounts[id]}
                      index={i++}
                      onContextMenu={(e) => openContextMenu(e, hideMenu(id))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div ref={sectionsRef} className="sidebar-reorder sidebar-sections">
          {sectionIds.map((id) => sections[id]())}
        </div>
      </div>

      <div className="sidebar-footer" data-tour="sidebar-footer">
        {onlineEnabled && footerShown("online") && (
          <NavRow
            nav={{ kind: "online" }}
            icon={SIDEBAR_ICONS.online}
            label={t("side.online")}
            index={i++}
            onContextMenu={(e) => openContextMenu(e, hideMenu("online"))}
          />
        )}
        {footerShown("trash") && (
          <NavRow
            nav={{ kind: "trash" }}
            icon={SIDEBAR_ICONS.trash}
            label={t("side.trash")}
            count={trash.length}
            index={i++}
            onContextMenu={(e) => openContextMenu(e, hideMenu("trash"))}
          />
        )}
        {footerShown("about") && (
          <NavRow
            nav={{ kind: "about" }}
            icon={SIDEBAR_ICONS.about}
            label={t("side.about")}
            index={i++}
            onContextMenu={(e) => openContextMenu(e, hideMenu("about"))}
          />
        )}
        {footerShown("shortcuts") && (
          <motion.button
            className="nav-row"
            onClick={() => useFontStore.getState().setHelpOpen(true)}
            onContextMenu={(e) => openContextMenu(e, hideMenu("shortcuts"))}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springSoft, delay: staggerDelay(i++) }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="nav-icon">
              <Keyboard size={15} strokeWidth={1.5} />
            </span>
            <span className="nav-label">{t("side.shortcuts")}</span>
            <kbd className="kbd nav-kbd">?</kbd>
          </motion.button>
        )}
      </div>
      <SidebarResizer />
    </motion.aside>
  );
}
