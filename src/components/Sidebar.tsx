import { motion } from "motion/react";
import { FolderOpen, Info, Keyboard, Library, Plus, Star, Tag, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openContextMenu } from "../design/primitives/ContextMenu";
import { spring, springSoft, staggerDelay } from "../design/springs";
import { allTags, familiesFor, useFontStore, type Family, type Nav } from "../state/fontStore";
import { exportFontList } from "../lib/menus";

function navKey(n: Nav): string {
  if (n.kind === "tag") return `tag:${n.tag}`;
  if (n.kind === "collection") return `col:${n.name}`;
  if (n.kind === "favorites") return "favorites";
  return n.kind;
}

function NavRow({
  nav,
  icon,
  label,
  count,
  index,
  onContextMenu,
}: {
  nav: Nav;
  icon: React.ReactNode;
  label: string;
  count?: number;
  index: number;
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

function NewCollectionInput({ onDone }: { onDone: () => void }) {
  const createCollection = useFontStore((s) => s.createCollection);
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => ref.current?.focus(), []);

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
        placeholder="Collection name…"
        aria-label="New collection name"
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
        aria-label="Rename collection"
        spellCheck={false}
      />
    </div>
  );
}

export function Sidebar() {
  const fonts = useFontStore((s) => s.fonts);
  const tags = useFontStore((s) => s.tags);
  const collections = useFontStore((s) => s.collections);
  const favorites = useFontStore((s) => s.favorites);
  const trash = useFontStore((s) => s.trash);
  const deleteCollection = useFontStore((s) => s.deleteCollection);
  const renameCollection = useFontStore((s) => s.renameCollection);
  const setFamilyTags = useFontStore((s) => s.setFamilyTags);
  const pendingCollectionFor = useFontStore((s) => s.pendingCollectionFor);

  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);


  useEffect(() => {
    if (pendingCollectionFor) setCreating(true);
  }, [pendingCollectionFor]);

  const familyCount = familiesFor(fonts, tags).size;
  const tagCounts = allTags(tags);
  const collectionNames = Object.keys(collections).sort((a, b) => a.localeCompare(b));

  const removeTagEverywhere = (tag: string) => {
    for (const [family, list] of Object.entries(tags)) {
      if (list.includes(tag)) {
        void setFamilyTags(family, list.filter((t) => t !== tag));
      }
    }
  };

  let i = 0;
  return (
    <motion.aside
      className="sidebar"
      initial={{ x: -48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={springSoft}
    >
      <div className="sidebar-section">
        <div className="sidebar-heading">Browse</div>
        <NavRow
          nav={{ kind: "library" }}
          icon={<Library size={15} strokeWidth={1.5} />}
          label="Library"
          count={familyCount}
          index={i++}
        />
        <NavRow
          nav={{ kind: "favorites" }}
          icon={<Star size={15} strokeWidth={1.5} />}
          label="Favorites"
          count={favorites.length}
          index={i++}
        />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-heading sidebar-heading-row">
          <span>Collections</span>
          <motion.button
            className="sidebar-add"
            aria-label="New collection"
            onClick={() => setCreating(true)}
            whileTap={{ scale: 0.9 }}
          >
            <Plus size={13} strokeWidth={2} />
          </motion.button>
        </div>
        {creating && (
          <NewCollectionInput
            onDone={() => {
              setCreating(false);
              useFontStore.setState({ pendingCollectionFor: null });
            }}
          />
        )}
        {collectionNames.map((name) =>
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
                  { label: "Rename", action: () => setRenaming(name) },
                  {
                    label: "Export font list (metadata)…",
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
                    label: "Delete collection",
                    danger: true,
                    action: () => void deleteCollection(name),
                  },
                ])
              }
            />
          ),
        )}
        {collectionNames.length === 0 && !creating && (
          <button className="sidebar-hint" onClick={() => setCreating(true)}>
            Create your first collection →
          </button>
        )}
      </div>

      {tagCounts.size > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-heading">Tags</div>
          {[...tagCounts.entries()].map(([tag, count]) => (
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
                    label: `Remove tag "${tag}" everywhere`,
                    danger: true,
                    action: () => removeTagEverywhere(tag),
                  },
                ])
              }
            />
          ))}
        </div>
      )}

      <div className="sidebar-footer">
        <NavRow
          nav={{ kind: "trash" }}
          icon={<Trash2 size={15} strokeWidth={1.5} />}
          label="Trash"
          count={trash.length}
          index={i++}
        />
        <NavRow
          nav={{ kind: "about" }}
          icon={<Info size={15} strokeWidth={1.5} />}
          label="About"
          index={i++}
        />

        <motion.button
          className="nav-row"
          onClick={() => useFontStore.getState().setHelpOpen(true)}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springSoft, delay: staggerDelay(i++) }}
          whileTap={{ scale: 0.97 }}
        >
          <span className="nav-icon">
            <Keyboard size={15} strokeWidth={1.5} />
          </span>
          <span className="nav-label">Shortcuts</span>
          <kbd className="kbd nav-kbd">?</kbd>
        </motion.button>
      </div>
    </motion.aside>
  );
}
