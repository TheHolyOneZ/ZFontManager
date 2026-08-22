import { AnimatePresence, motion } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { useEffect } from "react";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useT, type TKey } from "../lib/i18n";

const SECTIONS: [TKey, [string[], TKey][]][] = [
  [
    "sc.navigate",
    [
      [["Ctrl", "K"], "sc.palette"],
      [["/"], "sc.focusSearch"],
      [["↑", "↓", "←", "→"], "sc.move"],
      [["Home", "End"], "sc.firstLast"],
      [["Tab"], "sc.tab"],
      [["Esc"], "sc.esc"],
    ],
  ],
  [
    "sc.select",
    [
      [["Enter"], "sc.selectFocused"],
      [["Shift", "↑ ↓"], "sc.extend"],
      [["Ctrl", "Click"], "sc.addToSelection"],
      [["Shift", "Click"], "sc.selectRange"],
    ],
  ],
  [
    "sc.act",
    [
      [["Space"], "sc.toggleActive"],
      [["C"], "sc.compare"],
      [["F"], "sc.favorite"],
      [["Del"], "sc.trash"],
      [["Shift", "F10"], "sc.contextMenu"],
    ],
  ],
  [
    "sc.help",
    [[["?"], "sc.thisOverlay"]],
  ],
];

export function ShortcutsOverlay() {
  const t = useT();
  const open = useFontStore((s) => s.helpOpen);
  const setHelpOpen = useFontStore((s) => s.setHelpOpen);
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setHelpOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setHelpOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="compare-backdrop settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setHelpOpen(false)}
        >
          <motion.div
            ref={trapRef}
            className="shortcuts-panel glass-e3"
            initial={{ y: 24, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 16, scale: 0.98, opacity: 0 }}
            transition={springSoft}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t("shortcuts.aria")}
          >
            <header className="compare-head">
              <h2 className="compare-title">
                <Keyboard size={15} strokeWidth={1.5} /> {t("shortcuts.title")}
              </h2>
              <button
                className="detail-close"
                aria-label={t("shortcuts.close")}
                onClick={() => setHelpOpen(false)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>
            <div className="shortcuts-body">
              {SECTIONS.map(([section, rows]) => (
                <section key={section} className="shortcuts-section">
                  <h3 className="shortcuts-heading">{t(section)}</h3>
                  <ul className="shortcuts-list">
                    {rows.map(([keys, what]) => (
                      <li key={what} className="shortcuts-row">
                        <span className="shortcuts-keys">
                          {keys.map((k) => (
                            <kbd key={k} className="kbd">
                              {k === "Click" ? t("key.click") : k}
                            </kbd>
                          ))}
                        </span>
                        <span className="shortcuts-what">{t(what)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
