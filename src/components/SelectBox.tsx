import { Check, Minus } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";

export function SelectBox({ family, className = "" }: { family: string; className?: string }) {
  const t = useT();
  const checked = useFontStore((s) => s.selection.includes(family));
  const selecting = useFontStore((s) => s.selection.length > 1);

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    const st = useFontStore.getState();
    if (st.comparePicking) {
      st.togglePick(family);
      return;
    }
    st.toggleSelected(family, e.shiftKey);
  };

  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={t("sel.select", { name: family })}
      title={t("sel.select", { name: family })}
      tabIndex={-1}
      className={`select-box ${checked ? "select-box-on" : ""} ${selecting ? "select-box-selecting" : ""} ${className}`}
      onClick={onClick}
    >
      <Check size={11} strokeWidth={2.75} />
    </span>
  );
}

export function SelectAllBox({ names }: { names: string[] }) {
  const t = useT();
  const count = useFontStore(
    (s) => names.reduce((n, f) => (s.selection.includes(f) ? n + 1 : n), 0),
  );
  const all = names.length > 0 && count === names.length;
  const some = count > 0 && !all;
  const label = t(all ? "sel.clear" : "sel.selectAllCount", { count: names.length });

  const toggle = () => {
    const st = useFontStore.getState();
    if (all) st.select(null);
    else st.selectAll();
  };

  return (
    <span
      role="checkbox"
      aria-checked={all ? true : some ? "mixed" : false}
      aria-label={label}
      title={label}
      tabIndex={0}
      className={`select-box select-box-selecting ${all || some ? "select-box-on" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
    >
      {some ? <Minus size={11} strokeWidth={2.75} /> : <Check size={11} strokeWidth={2.75} />}
    </span>
  );
}
