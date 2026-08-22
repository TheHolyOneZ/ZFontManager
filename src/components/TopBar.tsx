import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpDown,
  Check,
  Columns2,
  Filter,
  LayoutGrid,
  List,
  RefreshCw,
  Rows3,
  Search,
  Type,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { springSnappy, springSoft } from "../design/springs";
import { SIZES, useFontStore, type SortMode } from "../state/fontStore";
import type { Classification } from "../lib/ipc";
import { useT, type TKey } from "../lib/i18n";

const SORT_MODES = ["name", "styles", "size"] as const satisfies readonly SortMode[];

const SORT_KEYS: Record<SortMode, TKey> = {
  name: "sort.name",
  styles: "sort.styles",
  size: "sort.size",
};

function SortMenu() {
  const t = useT();
  const sort = useFontStore((s) => s.sort);
  const setSort = useFontStore((s) => s.setSort);
  const [open, setOpen] = useState(false);

  return (
    <div className="sort-wrap">
      <motion.button
        className={`sort-btn ${open ? "sort-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        whileTap={{ scale: 0.96 }}
      >
        <ArrowUpDown size={13} strokeWidth={1.5} />
        <span>{t(SORT_KEYS[sort])}</span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div className="menu-backdrop" onClick={() => setOpen(false)} />
            <motion.ul
              className="sort-menu glass-e3"
              role="listbox"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.13 } }}
              transition={springSnappy}
            >
              {SORT_MODES.map((mode) => (
                <li key={mode}>
                  <button
                    role="option"
                    aria-selected={sort === mode}
                    className={sort === mode ? "sort-item sort-active" : "sort-item"}
                    onClick={() => {
                      setSort(mode);
                      setOpen(false);
                    }}
                  >
                    <span>{t(SORT_KEYS[mode])}</span>
                    {sort === mode && <Check size={13} strokeWidth={2} />}
                  </button>
                </li>
              ))}
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const CLASS_FILTERS = [
  "serif",
  "sans",
  "mono",
  "display",
  "script",
] as const satisfies readonly Classification[];

const SCRIPT_FILTERS = [
  "latin",
  "cyrillic",
  "greek",
  "arabic",
  "hebrew",
  "devanagari",
  "thai",
  "cjk",
  "korean",
  "vietnamese",
] as const;

function FilterMenu() {
  const t = useT();
  const classFilter = useFontStore((s) => s.classFilter);
  const toggleClassFilter = useFontStore((s) => s.toggleClassFilter);
  const scriptFilter = useFontStore((s) => s.scriptFilter);
  const toggleScriptFilter = useFontStore((s) => s.toggleScriptFilter);
  const variableOnly = useFontStore((s) => s.variableOnly);
  const setVariableOnly = useFontStore((s) => s.setVariableOnly);
  const [open, setOpen] = useState(false);

  const activeCount = classFilter.length + scriptFilter.length + (variableOnly ? 1 : 0);

  return (
    <div className="sort-wrap">
      <motion.button
        className={`sort-btn ${open ? "sort-open" : ""} ${activeCount > 0 ? "filter-live" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("filter.aria")}
        whileTap={{ scale: 0.96 }}
      >
        <Filter size={13} strokeWidth={1.5} />
        {activeCount > 0 && <span className="filter-count tabular">{activeCount}</span>}
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div className="menu-backdrop" onClick={() => setOpen(false)} />
            <motion.ul
              className="sort-menu filter-menu glass-e3"
              role="listbox"
              aria-multiselectable
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.13 } }}
              transition={springSnappy}
            >
              <li className="filter-heading" role="none">
                {t("filter.classification")}
              </li>
              {CLASS_FILTERS.map((c) => (
                <li key={c}>
                  <button
                    role="option"
                    aria-selected={classFilter.includes(c)}
                    className={classFilter.includes(c) ? "sort-item sort-active" : "sort-item"}
                    onClick={() => toggleClassFilter(c)}
                  >
                    <span>{t(`class.${c}`)}</span>
                    {classFilter.includes(c) && <Check size={13} strokeWidth={2} />}
                  </button>
                </li>
              ))}
              <li className="sort-sep" role="none" />
              <li className="filter-heading" role="none">
                {t("filter.languageSupport")}
              </li>
              {SCRIPT_FILTERS.map((sc) => (
                <li key={sc}>
                  <button
                    role="option"
                    aria-selected={scriptFilter.includes(sc)}
                    className={scriptFilter.includes(sc) ? "sort-item sort-active" : "sort-item"}
                    onClick={() => toggleScriptFilter(sc)}
                  >
                    <span>{t(`script.${sc}`)}</span>
                    {scriptFilter.includes(sc) && <Check size={13} strokeWidth={2} />}
                  </button>
                </li>
              ))}
              <li className="sort-sep" role="none" />
              <li>
                <button
                  role="option"
                  aria-selected={variableOnly}
                  className={variableOnly ? "sort-item sort-active" : "sort-item"}
                  onClick={() => setVariableOnly(!variableOnly)}
                >
                  <span>{t("filter.variableOnly")}</span>
                  {variableOnly && <Check size={13} strokeWidth={2} />}
                </button>
              </li>
            </motion.ul>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function RescanButton() {
  const t = useT();
  const rescan = useFontStore((s) => s.rescan);
  const scanning = useFontStore((s) => s.phase === "scanning");
  return (
    <motion.button
      className="rescan-btn"
      aria-label={t("top.rescan")}
      disabled={scanning}
      onClick={() => void rescan()}
      whileTap={{ scale: 0.94 }}
    >
      <motion.span
        className="rescan-icon"
        animate={scanning ? { rotate: 360 } : { rotate: 0 }}
        transition={
          scanning
            ? { duration: 1.2, repeat: Infinity, ease: "linear" }
            : { duration: 0.2 }
        }
      >
        <RefreshCw size={14} strokeWidth={1.5} />
      </motion.span>
    </motion.button>
  );
}

function CompareButton() {
  const t = useT();
  const selection = useFontStore((s) => s.selection);
  const picking = useFontStore((s) => s.comparePicking);
  const openCompare = useFontStore((s) => s.openCompare);
  const setComparePicking = useFontStore((s) => s.setComparePicking);
  const armed = selection.length >= 2;
  return (
    <motion.button
      className={`compare-btn ${armed ? "compare-armed" : picking ? "compare-picking" : ""}`}
      aria-label={
        armed
          ? t("compare.ariaArmed", { count: Math.min(selection.length, 4) })
          : picking
            ? t("compare.ariaCancelPicking")
            : t("compare.ariaIdle")
      }
      onClick={() => {
        if (armed) openCompare(selection);
        else setComparePicking(!picking);
      }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.96 }}
    >
      <Columns2 size={14} strokeWidth={1.5} />
      <span>
        {armed
          ? t("compare.buttonCount", { count: Math.min(selection.length, 4) })
          : picking
            ? t("compare.picking", { count: selection.length })
            : t("compare.button")}
      </span>
    </motion.button>
  );
}

export function TopBar() {
  const t = useT();
  const sampleText = useFontStore((s) => s.sampleText);
  const setSampleText = useFontStore((s) => s.setSampleText);
  const sizeIndex = useFontStore((s) => s.sizeIndex);
  const setSizeIndex = useFontStore((s) => s.setSizeIndex);
  const viewMode = useFontStore((s) => s.viewMode);
  const setViewMode = useFontStore((s) => s.setViewMode);
  const search = useFontStore((s) => s.search);
  const setSearch = useFontStore((s) => s.setSearch);

  const fill = (sizeIndex / (SIZES.length - 1)) * 100;

  return (
    <motion.header
      className="topbar"
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...springSoft, delay: 0.06 }}
    >
      <div className="topbar-field topbar-sample">
        <Type size={14} strokeWidth={1.5} className="field-icon" />
        <input
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder={t("top.samplePlaceholder")}
          aria-label={t("top.sampleAria")}
          spellCheck={false}
        />
      </div>

      <div className="topbar-size" style={{ "--fill": `${fill}%` } as CSSProperties}>
        <input
          type="range"
          min={0}
          max={SIZES.length - 1}
          step={1}
          value={sizeIndex}
          onChange={(e) => setSizeIndex(Number(e.target.value))}
          aria-label={t("top.sizeAria")}
        />
        <span className="size-value tabular">{SIZES[sizeIndex]}</span>
      </div>

      <div className="topbar-field topbar-search">
        <Search size={14} strokeWidth={1.5} className="field-icon" />
        <input
          id="global-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("top.searchPlaceholder")}
          aria-label={t("top.searchAria")}
          spellCheck={false}
        />
      </div>

      <FilterMenu />

      <SortMenu />

      <CompareButton />

      <RescanButton />

      <div className="view-toggle" role="tablist" aria-label={t("top.viewMode")}>
        {(["grid", "list", "waterfall"] as const).map((mode) => (
          <motion.button
            key={mode}
            role="tab"
            aria-selected={viewMode === mode}
            className={`view-btn ${viewMode === mode ? "view-btn-active" : ""}`}
            onClick={() => setViewMode(mode)}
            whileTap={{ scale: 0.94 }}
          >
            {mode === "grid" ? (
              <LayoutGrid size={15} strokeWidth={1.5} />
            ) : mode === "list" ? (
              <List size={15} strokeWidth={1.5} />
            ) : (
              <Rows3 size={15} strokeWidth={1.5} />
            )}
          </motion.button>
        ))}
      </div>
    </motion.header>
  );
}
