import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect } from "react";
import { springSoft } from "../design/springs";
import { useFontCss } from "../lib/fontLoader";
import { familiesFor, useFontStore, type Family } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { FormatBadge } from "./FamilyCard";

const COMPARE_SIZES = [14, 24, 40];

function CompareColumn({ family, onRemove }: { family: Family; onRemove: () => void }) {
  const sampleText = useFontStore((s) => s.sampleText);
  const lead = family.faces.find((f) => f.style === "Regular") ?? family.faces[0];
  const { fontFamily } = useFontCss(lead);
  const text = sampleText.trim() || family.name;

  return (
    <div className="compare-col">
      <header className="compare-col-head">
        <FormatBadge format={family.formats[0]} isVariable={family.isVariable} />
        <span className="compare-col-name">{family.name}</span>
        <button className="detail-close" aria-label={`Remove ${family.name}`} onClick={onRemove}>
          <X size={13} strokeWidth={1.5} />
        </button>
      </header>
      <div
        className="compare-hero"
        style={{
          fontFamily: fontFamily ?? undefined,
          fontStyle: lead.italic ? "italic" : "normal",
        }}
      >
        Aa
      </div>
      {COMPARE_SIZES.map((px) => (
        <p
          key={px}
          className="compare-line"
          style={{
            fontFamily: fontFamily ?? undefined,
            fontSize: px,
            fontStyle: lead.italic ? "italic" : "normal",
          }}
        >
          {text}
        </p>
      ))}
      <div className="compare-meta tabular">
        {family.faces.length} styles · {family.formats.join(", ").toUpperCase()}
      </div>
    </div>
  );
}


export function CompareOverlay() {
  const compare = useFontStore((s) => s.compare);
  const closeCompare = useFontStore((s) => s.closeCompare);
  const openCompare = useFontStore((s) => s.openCompare);
  const fonts = useFontStore((s) => s.fonts);
  const tags = useFontStore((s) => s.tags);
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(compare));

  useEffect(() => {
    if (!compare) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCompare();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compare, closeCompare]);

  const familyMap = familiesFor(fonts, tags);
  const families = (compare ?? [])
    .map((n) => familyMap.get(n))
    .filter((f): f is Family => Boolean(f));

  return (
    <AnimatePresence>
      {compare && families.length > 0 && (
        <motion.div
          className="compare-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={closeCompare}
        >
          <motion.div
            ref={trapRef}
            className="compare-panel glass-e3"
            initial={{ y: 40, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 24, scale: 0.98, opacity: 0 }}
            transition={springSoft}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Compare fonts"
          >
            <header className="compare-head">
              <h2 className="compare-title">Compare</h2>
              <button className="detail-close" aria-label="Close compare" onClick={closeCompare}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>
            <div className="compare-grid" style={{ "--cols": families.length } as React.CSSProperties}>
              {families.map((f) => (
                <CompareColumn
                  key={f.name}
                  family={f}
                  onRemove={() => {
                    const next = (compare ?? []).filter((n) => n !== f.name);
                    if (next.length < 2) closeCompare();
                    else openCompare(next);
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
