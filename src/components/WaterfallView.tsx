import { motion } from "motion/react";
import { Rows3 } from "lucide-react";
import { spring, staggerDelay } from "../design/springs";
import { useFontCss } from "../lib/fontLoader";
import { useFontStore, type Family } from "../state/fontStore";
import { useT } from "../lib/i18n";

const WATERFALL_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96];


export function WaterfallView({ families }: { families: Family[] }) {
  const t = useT();
  const selectedFamily = useFontStore((s) => s.selectedFamily);
  const sampleText = useFontStore((s) => s.sampleText);

  const family =
    families.find((f) => f.name === selectedFamily) ?? families[0] ?? null;
  const lead =
    family?.faces.find((f) => f.style === "Regular") ?? family?.faces[0] ?? null;
  const { fontFamily } = useFontCss(lead);

  if (!family || !lead) {
    return (
      <motion.div
        className="empty-state"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <span className="empty-tile">
          <Rows3 size={26} strokeWidth={1.5} />
        </span>
        <h2>{t("waterfall.emptyTitle")}</h2>
        <p>{t("waterfall.emptyBody")}</p>
      </motion.div>
    );
  }

  const text = sampleText.trim() || family.name;
  return (
    <div className="waterfall-view">
      <div className="waterfall-head">
        <span className="waterfall-title">{family.name}</span>
        <span className="waterfall-sub">{lead.style}</span>
      </div>
      {WATERFALL_SIZES.map((px, i) => (
        <motion.p
          key={px}
          className="waterfall-full-line"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: staggerDelay(i) }}
          style={{
            fontFamily: fontFamily ?? undefined,
            fontSize: px,
            fontStyle: lead.italic ? "italic" : "normal",
          }}
        >
          <span className="waterfall-px tabular">{px}</span>
          <span className="waterfall-text">{text}</span>
        </motion.p>
      ))}
    </div>
  );
}
