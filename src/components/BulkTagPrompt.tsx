import { AnimatePresence, motion } from "motion/react";
import { Check, CornerDownLeft, Minus, Plus, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { springSoft } from "../design/springs";
import { allTags, useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { playTag } from "../lib/sound";
import { useT } from "../lib/i18n";

function TagChip({
  name,
  count,
  total,
  highlighted,
  fresh,
  onToggle,
}: {
  name: string;
  count: number;
  total: number;
  highlighted: boolean;
  fresh: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const on = count === total;
  const some = count > 0 && !on;
  const boxRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!fresh || !chipRef.current) return;
    gsap.fromTo(
      chipRef.current,
      { autoAlpha: 0, scale: 0.88 },
      { autoAlpha: 1, scale: 1, duration: 0.34, ease: "back.out(2.2)", clearProps: "transform,opacity,visibility" },
    );
  }, [fresh]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!boxRef.current) return;
    gsap.fromTo(
      boxRef.current,
      { scale: 0.55 },
      { scale: 1, duration: 0.42, ease: "back.out(3)", overwrite: true },
    );
  }, [on, some]);

  return (
    <button
      ref={chipRef}
      className={`tagger-chip ${on ? "is-on" : some ? "is-some" : ""} ${highlighted ? "is-hl" : ""}`}
      aria-pressed={on ? true : some ? "mixed" : false}
      title={t("bulk.chipCount", { count, total })}
      onClick={onToggle}
    >
      <span ref={boxRef} className="tagger-box" aria-hidden>
        {on ? <Check size={10} strokeWidth={3} /> : some ? <Minus size={10} strokeWidth={3} /> : null}
      </span>
      <span className="tagger-chip-name">{name}</span>
      {some && <span className="tagger-chip-count tabular">{count}/{total}</span>}
    </button>
  );
}

export function BulkTagPrompt() {
  const t = useT();
  const bulkTagFor = useFontStore((s) => s.bulkTagFor);
  const setBulkTagFor = useFontStore((s) => s.setBulkTagFor);
  const applyTagToFamilies = useFontStore((s) => s.applyTagToFamilies);
  const tags = useFontStore((s) => s.tags);
  const trapRef = useFocusTrap<HTMLDivElement>(Boolean(bulkTagFor));
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [created, setCreated] = useState<string[]>([]);

  useEffect(() => {
    if (bulkTagFor) {
      setQuery("");
      setCreated([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [bulkTagFor]);

  const known = useMemo(() => [...allTags(tags).keys()], [tags]);
  const clean = query.trim().toLowerCase();
  const shown = clean ? known.filter((name) => name.includes(clean)) : known;
  const exact = clean ? known.includes(clean) : false;
  const total = bulkTagFor?.length ?? 0;

  const canCreate = Boolean(clean) && !exact;
  const choices = [...(canCreate ? ["\u0000create"] : []), ...shown];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!clean) setActive(-1);
    else if (exact) setActive(choices.indexOf(clean));
    else setActive(0);
  }, [clean, exact]);

  const changeQuery = (value: string) => setQuery(value);

  const countOf = (name: string) =>
    bulkTagFor ? bulkTagFor.filter((f) => (tags[f] ?? []).includes(name)).length : 0;

  const toggle = (name: string) => {
    if (!bulkTagFor) return;
    const on = countOf(name) === bulkTagFor.length;
    playTag(!on);
    void applyTagToFamilies(name, bulkTagFor);
  };

  const commit = () => {
    if (!bulkTagFor || !clean) return;
    if (!known.includes(clean)) setCreated((c) => [...c, clean]);
    if (countOf(clean) !== bulkTagFor.length) {
      playTag(true);
      void applyTagToFamilies(clean, bulkTagFor);
    }
    changeQuery("");
    inputRef.current?.focus();
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
            className="tagger glass-e3"
            initial={{ y: 18, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.99, opacity: 0 }}
            transition={springSoft}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t("bulk.aria")}
          >
            <header className="tagger-head">
              <h2 className="tagger-title">{t("bulk.title", { count: total })}</h2>
              <button
                className="detail-close"
                aria-label={t("bulk.cancel")}
                onClick={() => setBulkTagFor(null)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <label className="tagger-field">
              <Tag size={14} strokeWidth={1.6} className="tagger-field-icon" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    const dir = e.key === "ArrowDown" ? 1 : -1;
                    setActive((a) => Math.max(0, Math.min(choices.length - 1, a + dir)));
                  }
                  if (e.key === "Enter") {
                    const pick = choices[active];
                    if (pick && pick !== "\u0000create") {
                      toggle(pick);
                      changeQuery("");
                    } else commit();
                  }
                  if (e.key === "Escape") setBulkTagFor(null);
                }}
                placeholder={t(known.length > 0 ? "bulk.placeholderFind" : "bulk.placeholder")}
                aria-label={t("bulk.tagNameAria")}
                spellCheck={false}
              />
              {clean && (
                <kbd className="tagger-enter" aria-hidden>
                  <CornerDownLeft size={11} strokeWidth={1.8} />
                </kbd>
              )}
            </label>

            {clean && !exact && (
              <button className={`tagger-create ${choices[active] === "\u0000create" ? "is-hl" : ""}`} onClick={commit}>
                <span className="tagger-create-plus">
                  <Plus size={12} strokeWidth={2.2} />
                </span>
                <span className="tagger-create-text">
                  {t("bulk.create", { tag: clean, count: total })}
                </span>
              </button>
            )}

            {known.length === 0 ? (
              <p className="tagger-empty">{t("bulk.empty")}</p>
            ) : (
              <>
                <div className="tagger-section">
                  <span>{t(clean ? "bulk.matching" : "bulk.yourTags")}</span>
                  <span className="tabular">{shown.length}</span>
                </div>
                <div className="tagger-chips">
                  {shown.map((name) => (
                    <TagChip
                      key={name}
                      name={name}
                      count={countOf(name)}
                      total={total}
                      highlighted={choices[active] === name}
                      fresh={created.includes(name)}
                      onToggle={() => toggle(name)}
                    />
                  ))}
                  {shown.length === 0 && <span className="tagger-none">{t("bulk.noMatch")}</span>}
                </div>
              </>
            )}

            <footer className="tagger-foot">
              <span className="tagger-hint">{t("bulk.hint")}</span>
              <button className="tagger-done" onClick={() => setBulkTagFor(null)}>
                {t("bulk.done")}
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
