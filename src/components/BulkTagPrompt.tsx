import { AnimatePresence, motion } from "motion/react";
import { Tag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { playTag } from "../lib/sound";


export function BulkTagPrompt() {
  const bulkTagFor = useFontStore((s) => s.bulkTagFor);
  const setBulkTagFor = useFontStore((s) => s.setBulkTagFor);
  const applyTagToFamilies = useFontStore((s) => s.applyTagToFamilies);
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(bulkTagFor));
  const [tag, setTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bulkTagFor) {
      setTag("");

      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [bulkTagFor]);

  const apply = () => {
    if (bulkTagFor && tag.trim()) {
      playTag(true);
      void applyTagToFamilies(tag, bulkTagFor);
    }
    setBulkTagFor(null);
  };

  return (
    <AnimatePresence>
      {bulkTagFor && (
        <motion.div
          className="compare-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setBulkTagFor(null)}
        >
          <motion.div
            ref={trapRef}
            className="bulktag-panel glass-e3"
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={springSoft}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Tag selected fonts"
          >
            <header className="compare-head">
              <h2 className="bulktag-title">
                <Tag size={15} strokeWidth={1.5} />
                Tag {bulkTagFor.length} fonts
              </h2>
              <button
                className="detail-close"
                aria-label="Cancel"
                onClick={() => setBulkTagFor(null)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>
            <div className="topbar-field">
              <input
                ref={inputRef}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") apply();
                  if (e.key === "Escape") setBulkTagFor(null);
                }}
                placeholder="Tag name…"
                aria-label="Tag name"
                spellCheck={false}
              />
            </div>
            <motion.button
              className="bulktag-apply"
              disabled={!tag.trim()}
              onClick={apply}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              Apply to {bulkTagFor.length} fonts
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
