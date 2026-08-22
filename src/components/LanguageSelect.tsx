import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { springSnappy } from "../design/springs";
import { detectLocale, LOCALES, useLocalePref, useT, type LocalePref } from "../lib/i18n";
import { useFontStore } from "../state/fontStore";

interface Choice {
  value: LocalePref;
  label: string;
  hint: string;
}

const MARGIN = 10;
const GAP = 6;
const MIN_WIDTH = 236;
const MAX_HEIGHT = 344;

interface Box {
  left: number;
  top: number;
  width: number;
  above: boolean;
}

function boxFor(trigger: DOMRect, menuHeight: number): Box {
  const width = Math.max(trigger.width, MIN_WIDTH);
  const height = Math.min(menuHeight, MAX_HEIGHT);
  const below = trigger.bottom + GAP;
  const above = below + height + MARGIN > window.innerHeight && trigger.top - GAP - height >= MARGIN;
  return {
    width,
    above,
    left: Math.min(
      Math.max(MARGIN, trigger.right - width),
      Math.max(MARGIN, window.innerWidth - width - MARGIN),
    ),
    top: above
      ? trigger.top - GAP - height
      : Math.min(below, Math.max(MARGIN, window.innerHeight - height - MARGIN)),
  };
}

export function LanguageSelect() {
  const t = useT();
  const pref = useLocalePref();
  const setLocalePref = useFontStore((s) => s.setLocalePref);

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const systemName = LOCALES.find((l) => l.code === detectLocale())?.name ?? "";
  const choices: Choice[] = [
    { value: "system", label: t("settings.languageSystem"), hint: systemName },
    ...LOCALES.map((l) => ({ value: l.code, label: l.name, hint: l.english })),
  ];
  const selected = Math.max(
    0,
    choices.findIndex((c) => c.value === pref),
  );
  const current = choices[selected];

  const place = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger) return;
    setBox(boxFor(trigger.getBoundingClientRect(), menu?.scrollHeight ?? MAX_HEIGHT));
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);

    const onScroll = (e: Event) => {
      const target = e.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const commit = (value: LocalePref) => {
    setLocalePref(value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setActive(selected);
        setOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(choices[active].value);
      return;
    }
    const moves: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      Home: 0,
      End: choices.length - 1,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(Math.min(Math.max(0, moves[e.key]), choices.length - 1));
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`lang-trigger ${open ? "lang-trigger-open" : ""}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="language-listbox"
        aria-activedescendant={open ? `language-option-${active}` : undefined}
        aria-label={t("settings.language")}
        onClick={() => {
          setActive(selected);
          setOpen((v) => !v);
        }}
        onKeyDown={onKeyDown}
      >
        <span className="lang-trigger-label">{current.label}</span>
        {pref === "system" && current.hint && (
          <span className="lang-trigger-hint">{current.hint}</span>
        )}
        <motion.span
          className="lang-trigger-chevron"
          animate={{ rotate: open ? 180 : 0 }}
          transition={springSnappy}
        >
          <ChevronDown size={13} strokeWidth={1.5} />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="lang-backdrop" onClick={() => setOpen(false)} />
              <motion.div
                ref={menuRef}
                className="lang-menu glass-e3"
                style={{
                  left: box?.left ?? -9999,
                  top: box?.top ?? -9999,
                  width: box?.width ?? MIN_WIDTH,
                  transformOrigin: box?.above ? "bottom right" : "top right",
                }}
                initial={{ opacity: 0, scale: 0.97, y: box?.above ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={springSnappy}
              >
                <ul id="language-listbox" role="listbox" aria-label={t("settings.language")}>
                  {choices.map((choice, i) => {
                    const isSelected = i === selected;
                    return (
                      <li key={choice.value} role="none">
                        {i === 1 && <span className="lang-sep" />}
                        <button
                          type="button"
                          id={`language-option-${i}`}
                          role="option"
                          aria-selected={isSelected}
                          data-active={i === active}
                          className={`lang-option ${i === active ? "lang-option-active" : ""} ${
                            isSelected ? "lang-option-selected" : ""
                          }`}
                          tabIndex={-1}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => commit(choice.value)}
                        >
                          <span className="lang-option-text">
                            <span className="lang-option-label">{choice.label}</span>
                            {choice.hint && (
                              <span className="lang-option-hint">{choice.hint}</span>
                            )}
                          </span>
                          <span className="lang-option-check">
                            {isSelected && (
                              <motion.span
                                initial={{ scale: 0.4, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={springSnappy}
                                style={{ display: "grid", placeItems: "center" }}
                              >
                                <Check size={13} strokeWidth={2.5} />
                              </motion.span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
