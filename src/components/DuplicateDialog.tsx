import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { springSnappy } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";

export function DuplicateDialog() {
  const t = useT();
  const report = useFontStore((s) => s.duplicateReport);

  useEffect(() => {
    if (!report) return;
    const id = setTimeout(
      () => useFontStore.getState().setDuplicateReport(null),
      6500,
    );
    return () => clearTimeout(id);
  }, [report]);

  return (
    <AnimatePresence>
      {report && (
        <motion.div
          className="dup-backdrop"
          onClick={() => useFontStore.getState().setDuplicateReport(null)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className="dup-panel"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6, transition: { duration: 0.13 } }}
            transition={springSnappy}
          >
            <div className="dup-head">
              <AlertTriangle size={18} strokeWidth={2} className="dup-icon" />
              <span className="dup-title">
                {t("toast.duplicatesSkipped", { count: report.names.length })}
              </span>
            </div>
            <ul className="dup-list">
              {report.names.map((name) => (
                <li key={name} className="dup-item">
                  {name}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
