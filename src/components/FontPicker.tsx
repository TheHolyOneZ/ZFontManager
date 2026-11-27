import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "../design/primitives/Popover";
import { SYSTEM_FONT } from "../lib/appearance";
import { useT } from "../lib/i18n";
import { useFontStore } from "../state/fontStore";

const LIMIT = 240;

export function FontPicker({ value, onChange }: { value: string | null; onChange: (family: string | null) => void }) {
  const t = useT();
  const fonts = useFontStore((s) => s.fonts);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const families = useMemo(() => {
    const names = new Set<string>();
    for (const f of fonts) names.add(f.family);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [fonts]);

  const needle = query.trim().toLocaleLowerCase();
  const builtIns = [
    { value: null, label: t("appearance.fontDefault") },
    { value: SYSTEM_FONT, label: t("appearance.fontSystem") },
  ].filter((o) => !needle || o.label.toLocaleLowerCase().includes(needle));
  const matches = families.filter((f) => !needle || f.toLocaleLowerCase().includes(needle));
  const options = [...builtIns, ...matches.slice(0, LIMIT).map((f) => ({ value: f as string | null, label: f }))];

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => setActive(0), [needle]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-font-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  const current =
    value === null ? t("appearance.fontDefault") : value === SYSTEM_FONT ? t("appearance.fontSystem") : value;

  return (
    <>
      <button
        ref={ref}
        className={`font-field ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="font-field-name">{current}</span>
        <ChevronDown size={13} strokeWidth={1.6} />
      </button>
      <Popover
        anchorRef={ref}
        open={open}
        onClose={() => setOpen(false)}
        width={300}
        className="font-pop"
        label={t("appearance.font")}
      >
        <div className="font-pop-search">
          <Search size={13} strokeWidth={1.6} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("appearance.fontSearch", { count: families.length })}
            aria-label={t("appearance.fontSearchAria")}
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const o = options[active];
                if (o) pick(o.value);
              }
            }}
          />
        </div>
        <div ref={listRef} className="font-pop-list" role="listbox">
          {options.map((o, i) => (
            <button
              key={o.value ?? "\u0000default"}
              role="option"
              aria-selected={o.value === value}
              data-font-index={i}
              tabIndex={-1}
              className={`font-pop-item ${i === active ? "is-active" : ""} ${i === builtIns.length - 1 ? "is-last-builtin" : ""}`}
              onMouseMove={() => active !== i && setActive(i)}
              onClick={() => pick(o.value)}
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={13} strokeWidth={2} />}
            </button>
          ))}
          {matches.length > LIMIT && (
            <div className="font-pop-more">{t("appearance.fontMore", { count: matches.length - LIMIT })}</div>
          )}
          {options.length === 0 && <div className="font-pop-more">{t("appearance.fontNone")}</div>}
        </div>
      </Popover>
    </>
  );
}
