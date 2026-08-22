import { AnimatePresence, motion } from "motion/react";
import { Columns2, MousePointerClick, X } from "lucide-react";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";


export function SelectionBar() {
  const t = useT();
  const selection = useFontStore((s) => s.selection);
  const picking = useFontStore((s) => s.comparePicking);
  const compare = useFontStore((s) => s.compare);
  const openCompare = useFontStore((s) => s.openCompare);
  const setComparePicking = useFontStore((s) => s.setComparePicking);
  const ready = selection.length >= 2;
  const show = (picking || ready) && !compare;

  const dismiss = () => {
    setComparePicking(false);
    useFontStore.getState().select(null);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`selection-bar glass-e3 ${picking ? "selection-picking" : ""}`}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={springSoft}
          role="toolbar"
          aria-label={t("sel.aria")}
        >
          {picking ? (
            <>
              <span className="selection-step">
                <MousePointerClick size={15} strokeWidth={1.5} />
                {ready
                  ? t("sel.ready")
                  : selection.length === 1
                    ? t("sel.pickMore")
                    : t("sel.pickHint")}
              </span>
              <span className="selection-count tabular">{selection.length} / 4</span>
            </>
          ) : (
            <span className="selection-count tabular">{t("sel.count", { count: selection.length })}</span>
          )}
          <motion.button
            className={`selection-compare ${ready ? "" : "selection-compare-off"}`}
            disabled={!ready}
            onClick={() => openCompare(selection)}
            whileHover={ready ? { y: -1 } : undefined}
            whileTap={ready ? { scale: 0.97 } : undefined}
            animate={picking && ready ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={
              picking && ready
                ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
                : undefined
            }
          >
            <Columns2 size={14} strokeWidth={1.5} />
            {ready ? t("compare.buttonCount", { count: Math.min(selection.length, 4) }) : t("compare.button")}
            <kbd className="kbd selection-kbd">C</kbd>
          </motion.button>
          {!picking && <span className="selection-hint">{t("sel.rightClick")}</span>}
          <button
            className="detail-close"
            aria-label={picking ? t("sel.cancelCompare") : t("sel.clear")}
            onClick={dismiss}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
