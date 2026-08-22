import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { spring, staggerDelay } from "../design/springs";
import { openContextMenu } from "../design/primitives/ContextMenu";
import { useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";

export function TrashView() {
  const t = useT();
  const trash = useFontStore((s) => s.trash);
  const restoreTrash = useFontStore((s) => s.restoreTrash);
  const deleteTrashEntry = useFontStore((s) => s.deleteTrashEntry);
  const emptyTrash = useFontStore((s) => s.emptyTrash);

  if (trash.length === 0) {
    return (
      <motion.div
        className="empty-state"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
      >
        <span className="empty-tile"><Trash2 size={26} strokeWidth={1.5} /></span>
        <h2>{t("trash.emptyTitle")}</h2>
        <p>{t("trash.emptyBody")}</p>
      </motion.div>
    );
  }

  return (
    <div className="trash-view">
      <div className="trash-bar">
        <span className="tabular">
          {t("trash.count", { count: trash.length })}
        </span>
        <motion.button
          className="trash-empty-btn"
          onClick={() => void emptyTrash()}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
        >
          {t("trash.empty")}
        </motion.button>
      </div>
      <div className="trash-list">
        <AnimatePresence>
          {trash.map((entry, i) => (
            <motion.div
              key={entry.id}
              className="trash-row"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ ...spring, delay: staggerDelay(i) }}
              layout
              onContextMenu={(e) =>
                openContextMenu(e, [
                  { label: t("trash.restore"), action: () => void restoreTrash(entry.id) },
                  { kind: "separator" },
                  {
                    label: t("trash.deletePermanently"),
                    danger: true,
                    action: () => void deleteTrashEntry(entry.id),
                  },
                ])
              }
            >
              <div className="trash-info">
                <span className="trash-family">{entry.family}</span>
                <span className="trash-path detail-mono">{entry.originalPath}</span>
              </div>
              <motion.button
                className="trash-action"
                onClick={() => void restoreTrash(entry.id)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
              >
                <ArchiveRestore size={14} strokeWidth={1.5} />
                {t("trash.restore")}
              </motion.button>
              <motion.button
                className="trash-action trash-delete"
                onClick={() => void deleteTrashEntry(entry.id)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trash2 size={14} strokeWidth={1.5} />
                {t("trash.delete")}
              </motion.button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
