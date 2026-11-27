import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpDown,
  Check,
  CheckCheck,
  ChevronsDownUp,
  ChevronsUpDown,
  Columns2,
  Filter,
  GalleryVerticalEnd,
  LayoutGrid,
  List,
  RefreshCw,
  RotateCcw,
  Search,
  Type,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { springSnappy, springSoft } from "../design/springs";
import { SIZES, useFontStore, type SortMode } from "../state/fontStore";
import type { Classification, FontFormat } from "../lib/ipc";
import { useLocalePref, useT, type TKey } from "../lib/i18n";

const SORT_MODES = ["name", "styles", "size", "glyphs"] as const satisfies readonly SortMode[];

const SORT_KEYS: Record<SortMode, TKey> = {
  name: "sort.name",
  styles: "sort.styles",
  size: "sort.size",
  glyphs: "sort.glyphs",
};

const FORMAT_FILTERS = ["otf", "ttf", "woff", "woff2"] as const;

const FEATURE_FILTERS = ["swsh", "salt", "dlig", "smcp", "onum", "frac"] as const;
const SOURCE_FILTERS = ["all", "system", "user"] as const;

function SortMenu() {
  const t = useT();
  const sort = useFontStore((s) => s.sort);
  const setSort = useFontStore((s) => s.setSort);
  const [open, setOpen] = useState(false);

  return (
    <div className="sort-wrap" data-tour="sort">
      <motion.button
        className={`sort-btn ${open ? "sort-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t(SORT_KEYS[sort])}
        title={t(SORT_KEYS[sort])}
        whileTap={{ scale: 0.96 }}
      >
        <ArrowUpDown size={13} strokeWidth={1.5} />
        <span className="topbar-label">{t(SORT_KEYS[sort])}</span>
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

interface FilterOption {
  id: string;
  label: string;
  on: boolean;
  toggle: () => void;
}

interface FilterGroup {
  id: string;
  heading: string;
  options: FilterOption[];
}

function FilterMenu() {
  const t = useT();
  const classFilter = useFontStore((s) => s.classFilter);
  const toggleClassFilter = useFontStore((s) => s.toggleClassFilter);
  const scriptFilter = useFontStore((s) => s.scriptFilter);
  const toggleScriptFilter = useFontStore((s) => s.toggleScriptFilter);
  const variableOnly = useFontStore((s) => s.variableOnly);
  const setVariableOnly = useFontStore((s) => s.setVariableOnly);
  const toggleableOnly = useFontStore((s) => s.toggleableOnly);
  const setToggleableOnly = useFontStore((s) => s.setToggleableOnly);
  const formatFilter = useFontStore((s) => s.formatFilter);
  const toggleFormat = useFontStore((s) => s.toggleFormat);
  const featureFilter = useFontStore((s) => s.featureFilter);
  const toggleFeature = useFontStore((s) => s.toggleFeature);
  const sourceFilter = useFontStore((s) => s.sourceFilter);
  const setSourceFilter = useFontStore((s) => s.setSourceFilter);
  const charFilter = useFontStore((s) => s.charFilter);
  const charSearching = useFontStore((s) => s.charSearching);
  const setCharFilter = useFontStore((s) => s.setCharFilter);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const activeCount =
    classFilter.length +
    scriptFilter.length +
    formatFilter.length +
    featureFilter.length +
    (sourceFilter !== "all" ? 1 : 0) +
    (charFilter ? 1 : 0) +
    (variableOnly ? 1 : 0) +
    (toggleableOnly ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(-1);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const groups: FilterGroup[] = [
    {
      id: "show",
      heading: t("filter.show"),
      options: SOURCE_FILTERS.map((src) => ({
        id: `src-${src}`,
        label: t(`source.${src}`),
        on: sourceFilter === src,
        toggle: () => setSourceFilter(src),
      })),
    },
    {
      id: "class",
      heading: t("filter.classification"),
      options: CLASS_FILTERS.map((c) => ({
        id: `class-${c}`,
        label: t(`class.${c}`),
        on: classFilter.includes(c),
        toggle: () => toggleClassFilter(c),
      })),
    },
    {
      id: "script",
      heading: t("filter.languageSupport"),
      options: SCRIPT_FILTERS.map((sc) => ({
        id: `script-${sc}`,
        label: t(`script.${sc}`),
        on: scriptFilter.includes(sc),
        toggle: () => toggleScriptFilter(sc),
      })),
    },
    {
      id: "format",
      heading: t("filter.fileFormat"),
      options: FORMAT_FILTERS.map((fmt) => ({
        id: `fmt-${fmt}`,
        label: t(`format.${fmt}`),
        on: formatFilter.includes(fmt),
        toggle: () => toggleFormat(fmt as FontFormat),
      })),
    },
    {
      id: "feature",
      heading: t("filter.typography"),
      options: FEATURE_FILTERS.map((tag) => ({
        id: `feat-${tag}`,
        label: t(`feat.${tag}`),
        on: featureFilter.includes(tag),
        toggle: () => toggleFeature(tag),
      })),
    },
    {
      id: "more",
      heading: "",
      options: [
        {
          id: "variable",
          label: t("filter.variableOnly"),
          on: variableOnly,
          toggle: () => setVariableOnly(!variableOnly),
        },
        {
          id: "toggleable",
          label: t("filter.toggleableOnly"),
          on: toggleableOnly,
          toggle: () => setToggleableOnly(!toggleableOnly),
        },
      ],
    },
  ];

  const needle = query.trim().toLocaleLowerCase();
  const matches = (text: string) => text.toLocaleLowerCase().includes(needle);
  const visible = needle
    ? groups
        .map((g) => ({
          ...g,
          options: g.heading && matches(g.heading) ? g.options : g.options.filter((o) => matches(o.label)),
        }))
        .filter((g) => g.options.length > 0)
    : groups;
  const flat = visible.flatMap((g) => g.options);
  const showChar = !needle || matches(t("filter.containsChar"));

  useEffect(() => {
    setActive(needle && flat.length > 0 ? 0 : -1);
  }, [needle]);

  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    listRef.current
      .querySelector<HTMLElement>(`[data-opt-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[active]?.toggle();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (query) setQuery("");
      else setOpen(false);
    }
  };

  let index = 0;

  return (
    <div className="sort-wrap" data-tour="filter">
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
            <motion.div
              className="sort-menu filter-menu glass-e3"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.13 } }}
              transition={springSnappy}
              onKeyDown={onKeyDown}
            >
              <div className="filter-search">
                <Search size={13} strokeWidth={1.6} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("filter.searchPlaceholder")}
                  aria-label={t("filter.searchAria")}
                  aria-controls="filter-options"
                  aria-activedescendant={active >= 0 ? `filter-opt-${flat[active]?.id}` : undefined}
                  spellCheck={false}
                />
                {activeCount > 0 && !query && (
                  <button className="filter-clear" onClick={() => useFontStore.getState().clearFilters()}>
                    {t("filter.clearAll")}
                  </button>
                )}
              </div>
              <ul id="filter-options" ref={listRef} className="filter-list" role="listbox" aria-multiselectable>
                {visible.map((g, gi) => (
                  <li key={g.id} role="none" className="filter-group">
                    {gi > 0 && <div className="sort-sep" role="none" />}
                    {g.heading && <div className="filter-heading">{g.heading}</div>}
                    <ul role="group" aria-label={g.heading || undefined}>
                      {g.options.map((o) => {
                        const at = index++;
                        return (
                          <li key={o.id}>
                            <button
                              id={`filter-opt-${o.id}`}
                              role="option"
                              aria-selected={o.on}
                              data-opt-index={at}
                              tabIndex={-1}
                              className={`sort-item ${o.on ? "sort-active" : ""} ${at === active ? "is-active" : ""}`}
                              onMouseMove={() => active !== at && setActive(at)}
                              onClick={o.toggle}
                            >
                              <span>{o.label}</span>
                              {o.on && <Check size={13} strokeWidth={2} />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
                {showChar && (
                  <li role="none" className="filter-group">
                    <div className="sort-sep" role="none" />
                    <div className="filter-heading">{t("filter.containsChar")}</div>
                    <div className="filter-charrow">
                      <input
                        className="filter-charinput"
                        value={charFilter}
                        maxLength={2}
                        spellCheck={false}
                        placeholder={t("filter.containsCharPlaceholder")}
                        aria-label={t("filter.containsChar")}
                        onChange={(e) => setCharFilter(e.target.value)}
                      />
                      <span className="filter-charnote">
                        {charSearching
                          ? t("filter.containsCharSearching")
                          : charFilter
                            ? `U+${charFilter.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`
                            : t("filter.containsCharHint")}
                      </span>
                      {charFilter && (
                        <button
                          className="search-clear"
                          onClick={() => setCharFilter("")}
                          aria-label={t("filter.containsCharClear")}
                        >
                          <X size={13} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </li>
                )}
                {visible.length === 0 && !showChar && (
                  <li role="none" className="filter-empty">
                    {t("filter.noMatch", { query: query.trim() })}
                  </li>
                )}
              </ul>
            </motion.div>
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
      data-tour="rescan"
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

function ExpandStylesButton() {
  const t = useT();
  const on = useFontStore((s) => s.expandStyles);
  const setExpandStyles = useFontStore((s) => s.setExpandStyles);
  const label = t(on ? "top.collapseStyles" : "top.expandStyles");
  return (
    <motion.button
      className={`rescan-btn ${on ? "expand-on" : ""}`}
      data-tour="expand"
      aria-label={label}
      aria-pressed={on}
      title={label}
      onClick={() => setExpandStyles(!on)}
      whileTap={{ scale: 0.94 }}
    >
      {on ? <ChevronsDownUp size={14} strokeWidth={1.5} /> : <ChevronsUpDown size={14} strokeWidth={1.5} />}
    </motion.button>
  );
}

function SelectAllButton() {
  const t = useT();
  const total = useFontStore((s) => s.visibleOrder.length);
  const all = useFontStore((s) => {
    if (s.visibleOrder.length === 0 || s.selection.length < s.visibleOrder.length) return false;
    const chosen = new Set(s.selection);
    return s.visibleOrder.every((f) => chosen.has(f));
  });
  const label = all ? t("sel.clear") : t("sel.selectAllCount", { count: total });
  return (
    <motion.button
      className={`rescan-btn ${all ? "expand-on" : ""}`}
      data-tour="select-all"
      aria-label={label}
      aria-pressed={all}
      title={label}
      disabled={total === 0}
      onClick={() => {
        const st = useFontStore.getState();
        if (all) st.select(null);
        else st.selectAll();
      }}
      whileTap={{ scale: 0.94 }}
    >
      <CheckCheck size={14} strokeWidth={1.5} />
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
      data-tour="compare"
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
      <span className="topbar-label">
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
  const previewUppercase = useFontStore((s) => s.previewUppercase);
  const setPreviewUppercase = useFontStore((s) => s.setPreviewUppercase);
  const sizeIndex = useFontStore((s) => s.sizeIndex);
  const setSizeIndex = useFontStore((s) => s.setSizeIndex);
  const viewMode = useFontStore((s) => s.viewMode);
  const setViewMode = useFontStore((s) => s.setViewMode);
  const search = useFontStore((s) => s.search);
  const setSearch = useFontStore((s) => s.setSearch);
  const listing = useFontStore(
    (s) => !["trash", "about", "online"].includes(s.nav.kind) && s.viewMode !== "waterfall",
  );

  const fill = (sizeIndex / (SIZES.length - 1)) * 100;

  const barRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(Infinity);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const localePref = useLocalePref();
  const [fit, setFit] = useState({ wide: 980, stacked: 680 });
  useEffect(() => setFit({ wide: 980, stacked: 680 }), [localePref]);
  const stacked = width < 920;
  const compact = stacked ? width < fit.stacked : width < fit.wide;
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el || compact || !Number.isFinite(width)) return;
    if (el.scrollWidth <= el.clientWidth + 1) return;
    setFit((f) =>
      stacked ? { ...f, stacked: Math.max(f.stacked, width + 1) } : { ...f, wide: Math.max(f.wide, width + 1) },
    );
  });

  return (
    <motion.header
      ref={barRef}
      className={`topbar ${stacked ? "topbar-stacked" : ""} ${compact ? "topbar-compact" : ""}`}
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...springSoft, delay: 0.06 }}
    >
      <div className="topbar-field topbar-search" data-tour="search">
        <Search size={14} strokeWidth={1.5} className="field-icon" />
        <input
          id="global-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("top.searchPlaceholder")}
          aria-label={t("top.searchAria")}
          spellCheck={false}
        />
        {search.length > 0 && (
          <button
            className="search-clear"
            onClick={() => setSearch("")}
            aria-label={t("top.searchClear")}
          >
            <X size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      <div className="topbar-field topbar-sample" data-tour="sample">
        <Type size={14} strokeWidth={1.5} className="field-icon" />
        <input
          value={sampleText}
          onChange={(e) => setSampleText(e.target.value)}
          placeholder={t("top.samplePlaceholder")}
          aria-label={t("top.sampleAria")}
          spellCheck={false}
        />
        {sampleText !== t("preview.defaultSample") && (
          <button
            className="search-clear sample-reset"
            onClick={() => setSampleText(t("preview.defaultSample"))}
            aria-label={t("top.resetSample")}
            title={t("top.resetSample")}
          >
            <RotateCcw size={12} strokeWidth={2} />
          </button>
        )}
        <button
          className={`case-toggle ${previewUppercase ? "case-toggle-on" : ""}`}
          aria-label={t("top.uppercase")}
          aria-pressed={previewUppercase}
          title={t("top.uppercase")}
          onClick={() => setPreviewUppercase(!previewUppercase)}
        >
          AA
        </button>
      </div>

      {stacked && <span className="topbar-break" aria-hidden="true" />}

      <div className="topbar-size" data-tour="size" style={{ "--fill": `${fill}%` } as CSSProperties}>
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

      <FilterMenu />

      <SortMenu />

      <CompareButton />

      <RescanButton />

      {listing && <SelectAllButton />}

      {viewMode === "grid" && <ExpandStylesButton />}

      <div className="view-toggle" data-tour="views" role="tablist" aria-label={t("top.viewMode")}>
        {(["grid", "list", "cards"] as const).map((mode) => (
          <motion.button
            key={mode}
            role="tab"
            aria-label={t(mode === "grid" ? "palette.viewGrid" : mode === "list" ? "palette.viewList" : "palette.viewCards")}
            title={t(mode === "grid" ? "palette.viewGrid" : mode === "list" ? "palette.viewList" : "palette.viewCards")}
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
              <GalleryVerticalEnd size={15} strokeWidth={1.5} />
            )}
          </motion.button>
        ))}
      </div>
    </motion.header>
  );
}
