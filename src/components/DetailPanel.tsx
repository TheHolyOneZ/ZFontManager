import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Copy, Download, ExternalLink, FolderOpen, GripVertical, Plus, RotateCcw, Scale, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PillToggle } from "../design/primitives/PillToggle";
import { spring, springSoft } from "../design/springs";
import { useFontCss, formatBytes, pathBasename } from "../lib/fontLoader";
import { familiesFor, conflictsFor, useFontStore } from "../state/fontStore";
import { ipc, type FontFace, type VariationAxis } from "../lib/ipc";
import { toast } from "../design/primitives/Toast";
import { FormatBadge } from "./FamilyCard";
import { exportFace, exportFamily } from "../lib/menus";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { classifyLicense } from "../lib/license";
import { playStar, playTag } from "../lib/sound";

const WATERFALL = [14, 20, 28, 40, 56];


function StyleRow({
  face,
  family,
  selected,
  onSelect,
  synthesize,
}: {
  face: FontFace;
  family: string;
  selected: boolean;
  onSelect: () => void;
  synthesize: boolean;
}) {
  const { fontFamily } = useFontCss(face);
  return (
    <motion.button
      className={`style-row ${selected ? "style-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      whileTap={{ scale: 0.99 }}
    >
      <span
        className="style-name"
        style={{
          fontFamily: fontFamily ?? undefined,
          fontStyle: face.italic ? "italic" : "normal",
          fontWeight: synthesize ? face.weight : undefined,
        }}
      >
        {face.style}
      </span>
      <span className="style-fmt">{face.format.toUpperCase()}</span>
      <motion.span
        role="button"
        tabIndex={0}
        className="style-export"
        aria-label={`Export ${family} ${face.style}`}
        onClick={(e) => {
          e.stopPropagation();
          void exportFace(face.path, pathBasename(face.path));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            void exportFace(face.path, pathBasename(face.path));
          }
        }}
        whileTap={{ scale: 0.9 }}
      >
        <Download size={13} strokeWidth={1.5} />
      </motion.span>
    </motion.button>
  );
}


const FEATURE_NAMES: Record<string, string> = {
  liga: "Ligatures",
  dlig: "Discretionary ligatures",
  calt: "Contextual alternates",
  smcp: "Small caps",
  c2sc: "Caps to small caps",
  onum: "Oldstyle figures",
  lnum: "Lining figures",
  tnum: "Tabular figures",
  pnum: "Proportional figures",
  frac: "Fractions",
  ordn: "Ordinals",
  sups: "Superscript",
  subs: "Subscript",
  zero: "Slashed zero",
  salt: "Stylistic alternates",
  swsh: "Swashes",
  titl: "Titling",
  hist: "Historical forms",
};


const DEFAULT_ON = new Set(["liga", "calt"]);

function featureLabel(tag: string): string | null {
  if (FEATURE_NAMES[tag]) return FEATURE_NAMES[tag];
  const ss = /^ss(\d\d)$/.exec(tag);
  if (ss) return `Stylistic set ${Number(ss[1])}`;
  return null;
}

function FeatureChips({
  features,
  overrides,
  onToggle,
  onReset,
}: {
  features: string[];
  overrides: Record<string, boolean>;
  onToggle: (tag: string) => void;
  onReset: () => void;
}) {
  const dirty = Object.keys(overrides).length > 0;
  return (
    <div className="feat-wrap">
      <div className="feat-chips">
        {features.map((tag) => {
          const on = overrides[tag] ?? DEFAULT_ON.has(tag);
          return (
            <motion.button
              key={tag}
              className={`feat-chip ${on ? "feat-on" : ""}`}
              aria-pressed={on}
              title={tag}
              onClick={() => onToggle(tag)}
              whileTap={{ scale: 0.96 }}
            >
              {featureLabel(tag)}
            </motion.button>
          );
        })}
      </div>
      {dirty && (
        <button className="feat-reset" onClick={onReset}>
          <RotateCcw size={11} strokeWidth={1.5} /> Reset
        </button>
      )}
    </div>
  );
}

const AXIS_NAMES: Record<string, string> = {
  wght: "Weight",
  wdth: "Width",
  slnt: "Slant",
  ital: "Italic",
  opsz: "Optical size",
  GRAD: "Grade",
};


function AxisSliders({
  axes,
  values,
  onChange,
  onReset,
}: {
  axes: VariationAxis[];
  values: Record<string, number>;
  onChange: (tag: string, v: number) => void;
  onReset: () => void;
}) {
  const dirty = axes.some((a) => (values[a.tag] ?? a.default) !== a.default);
  return (
    <div className="axis-list">
      {axes.map((a) => {
        const v = values[a.tag] ?? a.default;
        const fill = a.max > a.min ? ((v - a.min) / (a.max - a.min)) * 100 : 0;
        return (
          <div key={a.tag} className="axis-row" style={{ "--fill": `${fill}%` } as React.CSSProperties}>
            <span className="axis-name">{AXIS_NAMES[a.tag] ?? a.tag}</span>
            <input
              type="range"
              min={a.min}
              max={a.max}
              step={(a.max - a.min) / 200 || 1}
              value={v}
              onChange={(e) => onChange(a.tag, Number(e.target.value))}
              aria-label={`${AXIS_NAMES[a.tag] ?? a.tag} axis`}
            />
            <span className="axis-value tabular">{Math.round(v)}</span>
          </div>
        );
      })}
      {dirty && (
        <button className="detail-heading-action axis-reset" onClick={onReset}>
          <RotateCcw size={11} strokeWidth={1.5} />
          Reset
        </button>
      )}
    </div>
  );
}

const charsetCache = new Map<string, number[]>();
const GLYPH_LIMIT = 512;


function GlyphMap({
  face,
  fontFamily,
  variation,
}: {
  face: FontFace;
  fontFamily: string | null;
  variation?: string;
}) {
  const [cps, setCps] = useState<number[] | null>(charsetCache.get(face.id) ?? null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const cached = charsetCache.get(face.id);
    if (cached) {
      setCps(cached);
      return;
    }
    setCps(null);
    let alive = true;
    ipc
      .getCharset(face.path, face.faceIndex)
      .then((list) => {
        charsetCache.set(face.id, list);
        if (alive) setCps(list);
      })
      .catch(() => alive && setCps([]));
    return () => {
      alive = false;
    };
  }, [face.id, face.path, face.faceIndex]);

  if (cps === null) {
    return <div className="skeleton glyph-skeleton" />;
  }
  if (cps.length === 0) {
    return <div className="glyph-empty">No character map available</div>;
  }

  const visible = showAll ? cps : cps.slice(0, GLYPH_LIMIT);
  return (
    <>
      <div className="glyph-grid">
        {visible.map((cp) => {
          const ch = String.fromCodePoint(cp);
          const hex = cp.toString(16).toUpperCase().padStart(4, "0");
          return (
            <button
              key={cp}
              className="glyph-cell"
              data-cp={`U+${hex}`}
              aria-label={`Copy character U+${hex}`}
              style={{
                fontFamily: fontFamily ?? undefined,
                fontVariationSettings: variation,
              }}
              onClick={() =>
                navigator.clipboard
                  .writeText(ch)
                  .then(() => toast.success(`Copied "${ch}"`, `U+${hex}`, "tick"))
                  .catch(() => toast.error("Couldn't copy"))
              }
            >
              {ch}
            </button>
          );
        })}
      </div>
      {cps.length > GLYPH_LIMIT && !showAll && (
        <button className="glyph-more" onClick={() => setShowAll(true)}>
          Show all {cps.length} glyphs
        </button>
      )}
    </>
  );
}


function NoteEditor({ family }: { family: string }) {
  const saved = useFontStore((s) => s.notes[family] ?? "");
  const setFamilyNote = useFontStore((s) => s.setFamilyNote);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [family, saved]);

  return (
    <textarea
      className="note-editor"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== saved && void setFamilyNote(family, draft)}
      placeholder="Notes — e.g. licensed for Client X only…"
      aria-label="Font notes"
      rows={2}
      spellCheck={false}
    />
  );
}

function LicenseSection({ license, licenseUrl }: { license: string | null; licenseUrl: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!license && !licenseUrl) return null;
  const cls = classifyLicense(license);
  const label =
    cls === "open" ? "Likely open license" : cls === "restrictive" ? "Possibly restrictive" : "License unclassified";
  return (
    <div className={`license-box license-${cls}`}>
      <div className="license-head">
        <Scale size={13} strokeWidth={1.5} />
        <span className="license-label">{label}</span>
        {licenseUrl && (
          <button
            className="license-link"
            aria-label="Open license page"
            onClick={() => void openUrl(licenseUrl).catch(() => toast.error("Couldn't open link"))}
          >
            <ExternalLink size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {license && (
        <button className="license-text" onClick={() => setExpanded((v) => !v)}>
          {expanded || license.length <= 180 ? license : `${license.slice(0, 180)}… `}
          {license.length > 180 && (
            <span className="license-more">{expanded ? "less" : "more"}</span>
          )}
        </button>
      )}
      <div className="license-disclaimer">Best-effort reading of embedded metadata — not legal advice</div>
    </div>
  );
}

function TagEditor({ family, tags }: { family: string; tags: string[] }) {
  const setFamilyTags = useFontStore((s) => s.setFamilyTags);
  const [draft, setDraft] = useState("");

  const add = () => {
    const t = draft.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      playTag(true);
      void setFamilyTags(family, [...tags, t]);
    }
    setDraft("");
  };

  return (
    <div className="tag-editor">
      <AnimatePresence>
        {tags.map((t) => (
          <motion.span
            key={t}
            className="tag-chip"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={spring}
            layout
          >
            {t}
            <button
              aria-label={`Remove tag ${t}`}
              onClick={() => {
                playTag(false);
                void setFamilyTags(family, tags.filter((x) => x !== t));
              }}
            >
              <X size={11} strokeWidth={1.5} />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <div className="tag-input">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add tag…"
          aria-label="Add tag"
          spellCheck={false}
        />
        <button aria-label="Add tag" onClick={add} disabled={!draft.trim()}>
          <Plus size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

export function DetailPanel() {
  const selectedFamily = useFontStore((s) => s.selectedFamily);
  const fonts = useFontStore((s) => s.fonts);
  const tags = useFontStore((s) => s.tags);
  const select = useFontStore((s) => s.select);
  const setFamilyActive = useFontStore((s) => s.setFamilyActive);
  const uninstallFamily = useFontStore((s) => s.uninstallFamily);
  const sampleText = useFontStore((s) => s.sampleText);

  const panelWidth = useFontStore((s) => s.panelWidth);
  const setPanelWidth = useFontStore((s) => s.setPanelWidth);
  const dragging = useRef(false);

  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const onMove = (ev: PointerEvent) => {
        if (dragging.current) setPanelWidth(window.innerWidth - ev.clientX);
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setPanelWidth],
  );

  const family = selectedFamily
    ? familiesFor(fonts, tags).get(selectedFamily) ?? null
    : null;


  const [styleId, setStyleId] = useState<string | null>(null);
  const [axisValues, setAxisValues] = useState<Record<string, number>>({});

  const [features, setFeatures] = useState<string[]>([]);
  const [featureOverrides, setFeatureOverrides] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setStyleId(null);
    setAxisValues({});
    setFeatureOverrides({});
  }, [selectedFamily]);

  const favorites = useFontStore((s) => s.favorites);
  const toggleFavorite = useFontStore((s) => s.toggleFavorite);

  const lead =
    family?.faces.find((f) => f.id === styleId) ??
    family?.faces.find((f) => f.style === "Regular") ??
    family?.faces[0] ??
    null;
  const { fontFamily } = useFontCss(lead);
  const text = sampleText.trim() || family?.name || "";

  useEffect(() => {
    setFeatures([]);
    setFeatureOverrides({});
    if (!lead || lead.format === "woff" || lead.format === "woff2") return;
    let stale = false;
    ipc
      .getFeatures(lead.path, lead.faceIndex)
      .then((tags) => {
        if (!stale) setFeatures(tags.filter((t) => featureLabel(t) !== null));
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [lead?.id, lead?.path, lead?.faceIndex, lead?.format]);


  const featureSettings =
    Object.keys(featureOverrides).length > 0
      ? Object.entries(featureOverrides)
          .map(([tag, on]) => `"${tag}" ${on ? 1 : 0}`)
          .join(", ")
      : undefined;
  const favorite = family ? favorites.includes(family.name) : false;
  const conflicts = family ? conflictsFor(fonts).get(family.name) ?? [] : [];


  const variation =
    lead && lead.isVariable && Object.keys(axisValues).length > 0
      ? lead.axes
          .map((a) => `"${a.tag}" ${axisValues[a.tag] ?? a.default}`)
          .join(", ")
      : undefined;
  const canUninstall = family?.faces.some((f) => f.source !== "system") ?? false;

  return (
    <AnimatePresence>
      {family && lead && (
        <motion.aside
          className="detail glass-e3"
          style={{ width: panelWidth }}
          initial={{ x: panelWidth, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: panelWidth, opacity: 0 }}
          transition={springSoft}
        >
          <div
            className="detail-resize"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            onPointerDown={onResizeDown}
            onDoubleClick={() => setPanelWidth(348)}
          >
            <GripVertical size={12} strokeWidth={1.5} />
          </div>


          <motion.div
            key={family.name}
            className="detail-inner"
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } } }}
          >
            <motion.header
              className="detail-head"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <FormatBadge format={family.formats[0]} isVariable={family.isVariable} />
              <h2 className="detail-title">{family.name}</h2>
              <motion.button
                className={`star-btn ${favorite ? "star-on" : ""}`}
                aria-label={favorite ? "Unfavorite" : "Favorite"}
                aria-pressed={favorite}
                onClick={() => {
                  playStar(!favorite);
                  void toggleFavorite(family.name);
                }}
                whileTap={{ scale: 0.85 }}
              >
                <Star size={15} strokeWidth={1.5} />
              </motion.button>
              <button className="detail-close" aria-label="Close details" onClick={() => select(null)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </motion.header>

            <motion.section
              className="detail-specimen"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <span
                className="specimen-glyphs"
                style={{
                  fontFamily: fontFamily ?? undefined,
                  fontStyle: lead.italic ? "italic" : "normal",
                  fontVariationSettings: variation,
                }}
              >
                Aa
              </span>
              <span className="specimen-meta">
                <span className="specimen-style">{lead.style}</span>
                <span className="specimen-sub tabular">
                  {family.faces.length} style{family.faces.length === 1 ? "" : "s"} ·{" "}
                  {family.formats.join(" · ").toUpperCase()}
                </span>
              </span>
              <span
                className="specimen-strip"
                aria-hidden="true"
                style={{
                  fontFamily: fontFamily ?? undefined,
                  fontStyle: lead.italic ? "italic" : "normal",
                  fontVariationSettings: variation,
                  fontFeatureSettings: featureSettings,
                }}
              >
                ABCDEFGHIJKLM abcdefghijklm 0123456789 ?!&
              </span>
            </motion.section>

            <motion.section
              className={`detail-activate ${family.active ? "" : "card-inactive"}`}
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <div>
                <div className="activate-label">{family.active ? "Active" : "Inactive"}</div>
                <div className="activate-sub">
                  {family.deactivatable
                    ? "Visible in other apps' font pickers"
                    : "System font — managed by the OS"}
                </div>
              </div>
              <PillToggle
                on={family.active}
                disabled={!family.deactivatable}
                onChange={(on) => void setFamilyActive(family.name, on)}
                label={`${family.active ? "Deactivate" : "Activate"} ${family.name}`}
                size="lg"
              />
            </motion.section>

            <motion.section
              className="detail-waterfall"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              {WATERFALL.map((px) => (
                <p
                  key={px}
                  className="waterfall-line"
                  style={{
                    fontFamily: fontFamily ?? undefined,
                    fontSize: px,
                    fontStyle: lead.italic ? "italic" : "normal",
                    fontVariationSettings: variation,
                    fontFeatureSettings: featureSettings,
                  }}
                >
                  <span className="waterfall-px tabular">{px}</span>
                  {text}
                </p>
              ))}
            </motion.section>

            {lead.isVariable && lead.axes.length > 0 && (
              <motion.section
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
              >
                <div className="detail-heading">Variable axes</div>
                <AxisSliders
                  axes={lead.axes}
                  values={axisValues}
                  onChange={(tag, v) => setAxisValues((prev) => ({ ...prev, [tag]: v }))}
                  onReset={() => setAxisValues({})}
                />
              </motion.section>
            )}

            {features.length > 0 && (
              <motion.section
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
              >
                <div className="detail-heading">OpenType features</div>
                <FeatureChips
                  features={features}
                  overrides={featureOverrides}
                  onToggle={(tag) => {
                    const on = featureOverrides[tag] ?? DEFAULT_ON.has(tag);
                    const next = !on;
                    setFeatureOverrides((prev) => {
                      const copy = { ...prev };
                      if (next === DEFAULT_ON.has(tag)) delete copy[tag];
                      else copy[tag] = next;
                      return copy;
                    });
                  }}
                  onReset={() => setFeatureOverrides({})}
                />
              </motion.section>
            )}

            <motion.section
              className="detail-meta"
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <dl>
                <dt>Styles</dt>
                <dd className="tabular">{family.faces.length}</dd>
                <dt>Format</dt>
                <dd>{family.formats.join(", ").toUpperCase()}</dd>
                {family.classification !== "unknown" && (
                  <>
                    <dt>Class</dt>
                    <dd style={{ textTransform: "capitalize" }}>{family.classification}</dd>
                  </>
                )}
                {family.scripts.length > 0 && (
                  <>
                    <dt>Scripts</dt>
                    <dd>
                      {family.scripts
                        .map((s) => (s === "cjk" ? "CJK" : s[0].toUpperCase() + s.slice(1)))
                        .join(", ")}
                    </dd>
                  </>
                )}
                <dt>File size</dt>
                <dd className="tabular">{formatBytes(family.totalSize)}</dd>
                {family.foundry && (
                  <>
                    <dt>Foundry</dt>
                    <dd>{family.foundry}</dd>
                  </>
                )}
                {lead.postscriptName && (
                  <>
                    <dt>PostScript</dt>
                    <dd className="detail-mono">{lead.postscriptName}</dd>
                  </>
                )}
                <dt>Location</dt>
                <dd className="detail-mono detail-path">{lead.path}</dd>
                {family.isVariable && lead.axes.length > 0 && (
                  <>
                    <dt>Axes</dt>
                    <dd>
                      {lead.axes
                        .map((a) => `${a.tag} ${a.min}–${a.max}`)
                        .join(", ")}
                    </dd>
                  </>
                )}
              </dl>
            </motion.section>

            <motion.section
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <div className="detail-heading detail-heading-row">
                <span>Styles</span>
                <button
                  className="detail-heading-action"
                  onClick={() => void exportFamily(family)}
                >
                  <Download size={12} strokeWidth={1.5} />
                  Export all
                </button>
              </div>
              <div className="style-list">
                {family.faces.map((face) => (
                  <StyleRow
                    key={face.id}
                    face={face}
                    family={family.name}
                    selected={lead?.id === face.id}
                    onSelect={() => setStyleId(face.id)}
                    synthesize={family.faces.filter((f) => f.path === face.path).length > 1}
                  />
                ))}
              </div>
            </motion.section>

            {conflicts.length > 0 && (
              <motion.section
                className="conflict-section"
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
              >
                <div className="conflict-title">
                  <AlertTriangle size={13} strokeWidth={1.5} />
                  Name conflict
                </div>
                <p className="conflict-sub">
                  Multiple installed files claim the same identity. Apps may pick
                  either one unpredictably.
                </p>
                {conflicts.map((c) => (
                  <div key={c.key} className="conflict-group">
                    <span className="conflict-key detail-mono">{c.key}</span>
                    {c.paths.map((p) => (
                      <button
                        key={p}
                        className="conflict-path detail-mono"
                        onClick={() =>
                          revealItemInDir(p).catch(() => toast.error("Couldn't open file manager"))
                        }
                      >
                        <FolderOpen size={11} strokeWidth={1.5} />
                        {p}
                      </button>
                    ))}
                  </div>
                ))}
              </motion.section>
            )}

            <motion.section
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <div className="detail-heading detail-heading-row">
                <span>Glyphs</span>
                <span className="detail-heading-note">
                  <Copy size={10} strokeWidth={1.5} /> click to copy
                </span>
              </div>
              <GlyphMap face={lead} fontFamily={fontFamily} variation={variation} />
            </motion.section>

            {(lead.license || lead.licenseUrl) && (
              <motion.section
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
              >
                <div className="detail-heading">License</div>
                <LicenseSection license={lead.license} licenseUrl={lead.licenseUrl} />
              </motion.section>
            )}

            <motion.section
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <div className="detail-heading">Tags</div>
              <TagEditor family={family.name} tags={family.tags} />
            </motion.section>

            <motion.section
              variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
            >
              <div className="detail-heading">Notes</div>
              <NoteEditor family={family.name} />
            </motion.section>

            {canUninstall && (
              <motion.button
                className="detail-uninstall"
                onClick={() => void uninstallFamily(family.name)}
                variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: spring } }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                <Trash2 size={14} strokeWidth={1.5} />
                Move to Trash
              </motion.button>
            )}
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
