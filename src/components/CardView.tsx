import { useVirtualizer } from "@tanstack/react-virtual";
import { convertFileSrc } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { ImagePlus, Lock, Star } from "lucide-react";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PillToggle } from "../design/primitives/PillToggle";
import { spring, staggerDelay } from "../design/springs";
import { openContextMenu } from "../design/primitives/ContextMenu";
import { useFontCss } from "../lib/fontLoader";
import { buildFamilyMenu } from "../lib/menus";
import { playStar } from "../lib/sound";
import { useT } from "../lib/i18n";
import { SIZES, useFontStore, type Family } from "../state/fontStore";

const MIN_TILE = 220;
const GAP = 14;
const PAD = 20;
const FOOTER = 58;

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

const CoverTile = memo(function CoverTile({ family, cover }: { family: Family; cover: string | undefined }) {
  const t = useT();
  const sampleText = useFontStore((s) => s.sampleText);
  const sizeIndex = useFontStore((s) => s.sizeIndex);
  const selected = useFontStore((s) => s.selection.includes(family.name));
  const favorite = useFontStore((s) => s.favorites.includes(family.name));
  const selectWith = useFontStore((s) => s.selectWith);
  const toggleFavorite = useFontStore((s) => s.toggleFavorite);
  const setFamilyActive = useFontStore((s) => s.setFamilyActive);
  const chooseCover = useFontStore((s) => s.chooseCover);
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [cover]);

  const lead = family.faces.find((f) => f.style === "Regular") ?? family.faces[0];
  const showImage = Boolean(cover) && !broken;
  const { fontFamily } = useFontCss(showImage ? null : lead);
  const text = sampleText.trim() || family.name;

  return (
    <article
      className={`cover-card ${selected ? "card-selected" : ""} ${family.active ? "" : "cover-card-off"}`}
      data-family={family.name}
      tabIndex={0}
      role="button"
      aria-label={family.name}
      aria-pressed={selected}
      onClick={(e) => {
        const st = useFontStore.getState();
        if (st.comparePicking) {
          st.togglePick(family.name);
          return;
        }
        const mode = e.ctrlKey || e.metaKey ? "toggle" : e.shiftKey ? "range" : "single";
        selectWith(family.name, mode, st.visibleOrder);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.target !== e.currentTarget) return;
        e.preventDefault();
        selectWith(family.name, "single", useFontStore.getState().visibleOrder);
      }}
      onContextMenu={(e) => openContextMenu(e, buildFamilyMenu(family))}
    >
      <div
        className="cover-art"
        style={showImage ? undefined : { ["--cover-hue" as string]: hue(family.name) }}
      >
        {showImage ? (
          <img
            className="cover-img"
            src={convertFileSrc(cover as string)}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setBroken(true)}
          />
        ) : (
          <span
            className="cover-specimen"
            style={{
              fontFamily: fontFamily ?? undefined,
              fontSize: Math.min(SIZES[sizeIndex], 44),
              fontStyle: lead.italic ? "italic" : "normal",
              opacity: fontFamily ? 1 : 0,
            }}
          >
            {text}
          </span>
        )}
        <button
          className="cover-pick"
          aria-label={t(cover ? "cover.change" : "cover.set")}
          title={t(cover ? "cover.change" : "cover.set")}
          onClick={(e) => {
            e.stopPropagation();
            void chooseCover(family.name);
          }}
        >
          <ImagePlus size={14} strokeWidth={1.5} />
        </button>
      </div>
      <footer className="cover-foot">
        <div className="cover-titles">
          <span className="card-name">{family.name}</span>
          <span className="cover-meta tabular">{t("card.stylesCount", { count: family.faces.length })}</span>
        </div>
        <button
          className={`star-btn ${favorite ? "star-on" : ""}`}
          aria-label={t(favorite ? "card.unfavorite" : "card.favorite", { name: family.name })}
          aria-pressed={favorite}
          onClick={(e) => {
            e.stopPropagation();
            playStar(!favorite);
            void toggleFavorite(family.name);
          }}
        >
          <Star size={14} strokeWidth={1.5} />
        </button>
        {family.deactivatable ? (
          <PillToggle
            on={family.active}
            mixed={family.partial}
            onChange={(on) => void setFamilyActive(family.name, on)}
            label={t(family.active ? "card.deactivate" : "card.activate", { name: family.name })}
          />
        ) : (
          <span className="card-os-lock" title={t("card.osManaged")} aria-label={t("card.osManaged")}>
            <Lock size={11} strokeWidth={1.75} />
            {t("card.osManagedShort")}
          </span>
        )}
      </footer>
    </article>
  );
});

export function CardView({ families }: { families: Family[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const mountedAt = useRef(Date.now());
  const [width, setWidth] = useState(0);
  const covers = useFontStore((s) => s.covers);
  const selectedFamily = useFontStore((s) => s.selectedFamily);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const inner = Math.max(MIN_TILE, width - PAD * 2);
  const cols = Math.max(1, Math.floor((inner + GAP) / (MIN_TILE + GAP)));
  const tile = (inner - GAP * (cols - 1)) / cols;
  const rowHeight = Math.round(tile * 0.75 + FOOTER + GAP);
  const rows = Math.ceil(families.length / cols);

  const virtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, cols]);

  useEffect(() => {
    if (!selectedFamily) return;
    const idx = families.findIndex((f) => f.name === selectedFamily);
    if (idx >= 0) virtualizer.scrollToIndex(Math.floor(idx / cols), { align: "auto" });
  }, [selectedFamily]);

  const arriving = Date.now() - mountedAt.current < 1200;

  return (
    <div ref={parentRef} className="grid-scroll cards-scroll">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            className="cards-row"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: rowHeight - GAP,
              transform: `translateY(${row.start}px)`,
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              gap: GAP,
            }}
          >
            {families.slice(row.index * cols, row.index * cols + cols).map((family, i) => (
              <motion.div
                key={family.name}
                className="cards-cell"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: arriving ? staggerDelay(row.index * cols + i) : 0 }}
              >
                <CoverTile family={family} cover={covers[family.name]} />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
