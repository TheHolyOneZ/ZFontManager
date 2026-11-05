import { AnimatePresence, motion } from "motion/react";
import { Tag, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { springSoft } from "../design/springs";
import { allTags, useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { playTag } from "../lib/sound";
import { useT } from "../lib/i18n";

export function BulkTagPrompt() {
  const t = useT();
  const bulkTagFor = useFontStore((s) => s.bulkTagFor);
  const setBulkTagFor = useFontStore((s) => s.setBulkTagFor);
  const applyTagToFamilies = useFontStore((s) => s.applyTagToFamilies);
  const tags = useFontStore((s) => s.tags);
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(bulkTagFor));
  const [tag, setTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (bulkTagFor) {
      setTag("");

      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [bulkTagFor]);

  const add = () => {
    const clean = tag.trim().toLowerCase();
    if (!bulkTagFor || !clean) return;
    const everyone = bulkTagFor.every((f) => (tags[f] ?? []).includes(clean));
    if (!everyone) {
      playTag(true);
      void applyTagToFamilies(clean, bulkTagFor);
    }
    setTag("");
    inputRef.current?.focus();
  };

  const toggle = (name: string, on: boolean) => {
    if (!bulkTagFor) return;
    playTag(!on);
    void applyTagToFamilies(name, bulkTagFor);
  };

  const known = [...allTags(tags).keys()];

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
            aria-label={t("bulk.aria")}
          >
            <header className="compare-head">
              <h2 className="bulktag-title">
                <Tag size={15} strokeWidth={1.5} />
                {t("bulk.title", { count: bulkTagFor.length })}
              </h2>
              <button
                className="detail-close"
                aria-label={t("bulk.cancel")}
                onClick={() => setBulkTagFor(null)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>
            {known.length > 0 && (
              <div className="bulktag-chips">
                {known.map((name) => {
                  const count = bulkTagFor.filter((f) => (tags[f] ?? []).includes(name)).length;
                  const on = count === bulkTagFor.length;
                  return (
                    <button
                      key={name}
                      className={`bulktag-chip ${on ? "bulktag-chip-on" : count > 0 ? "bulktag-chip-some" : ""}`}
                      aria-pressed={on ? true : count > 0 ? "mixed" : false}
                      title={t("bulk.chipCount", { count, total: bulkTagFor.length })}
                      onClick={() => toggle(name, on)}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="topbar-field">
              <input
                ref={inputRef}
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                  if (e.key === "Escape") setBulkTagFor(null);
                }}
                placeholder={t("bulk.placeholder")}
                aria-label={t("bulk.tagNameAria")}
                spellCheck={false}
              />
            </div>
            <motion.button
              className="bulktag-apply"
              disabled={!tag.trim()}
              onClick={add}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              {t("bulk.apply", { count: bulkTagFor.length })}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
