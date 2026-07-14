import { AnimatePresence, motion } from "motion/react";
import { Keyboard, X } from "lucide-react";
import { useEffect } from "react";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";

const SECTIONS: [string, [string[], string][]][] = [
  [
    "Navigate",
    [
      [["Ctrl", "K"], "Command palette"],
      [["/"], "Focus search"],
      [["↑", "↓", "←", "→"], "Move through the library"],
      [["Home", "End"], "First / last font"],
      [["Tab"], "Walk every control (cards included)"],
      [["Esc"], "Close panels, deselect"],
    ],
  ],
  [
    "Select",
    [
      [["Enter"], "Select the focused card"],
      [["Shift", "↑ ↓"], "Extend the selection"],
      [["Ctrl", "Click"], "Add to selection"],
      [["Shift", "Click"], "Select a range"],
    ],
  ],
  [
    "Act on selection",
    [
      [["Space"], "Activate / deactivate"],
      [["C"], "Compare selected fonts (2–4)"],
      [["F"], "Favorite / unfavorite"],
      [["Del"], "Move to trash (restorable)"],
      [["Shift", "F10"], "Context menu — arrows to browse it"],
    ],
  ],
  [
    "Help",
    [[["?"], "This overlay"]],
  ],
];

export function ShortcutsOverlay() {
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
            aria-label="Keyboard shortcuts"
          >
            <header className="compare-head">
              <h2 className="compare-title">
                <Keyboard size={15} strokeWidth={1.5} /> Shortcuts
              </h2>
              <button
                className="detail-close"
                aria-label="Close shortcuts"
                onClick={() => setHelpOpen(false)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>
            <div className="shortcuts-body">
              {SECTIONS.map(([section, rows]) => (
                <section key={section} className="shortcuts-section">
                  <h3 className="shortcuts-heading">{section}</h3>
                  <ul className="shortcuts-list">
                    {rows.map(([keys, what]) => (
                      <li key={what} className="shortcuts-row">
                        <span className="shortcuts-keys">
                          {keys.map((k) => (
                            <kbd key={k} className="kbd">
                              {k}
                            </kbd>
                          ))}
                        </span>
                        <span className="shortcuts-what">{what}</span>
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
