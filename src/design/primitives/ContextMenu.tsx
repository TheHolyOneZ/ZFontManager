import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, MouseEvent as ReactMouseEvent } from "react";
import { create } from "zustand";
import { springSnappy } from "../springs";

export type MenuItem =
  | {
      kind?: "item";
      label: string;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
      action: () => void;
    }
  | { kind: "separator" }
  | { kind: "heading"; label: string }
  | { kind: "check"; label: string; checked: boolean; action: () => void };

interface MenuState {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  show: (x: number, y: number, items: MenuItem[]) => void;
  close: () => void;
}

const useMenuStore = create<MenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  items: [],
  show: (x, y, items) => set({ open: true, x, y, items }),
  close: () => set({ open: false }),
}));


export function openContextMenu(e: ReactMouseEvent, items: MenuItem[]) {
  e.preventDefault();
  e.stopPropagation();
  useMenuStore.getState().show(e.clientX, e.clientY, items);
}


export function openContextMenuAt(x: number, y: number, items: MenuItem[]) {
  useMenuStore.getState().show(x, y, items);
}

export function closeContextMenu() {
  useMenuStore.getState().close();
}

function MenuPanel({ x, y, items }: { x: number; y: number; items: MenuItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const close = useMenuStore((s) => s.close);


  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth - r.width - 8),
      y: Math.min(y, window.innerHeight - r.height - 8),
    });
  }, [x, y]);


  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const enabled = () =>
      [...el.querySelectorAll<HTMLButtonElement>("button.ctx-item:not(:disabled)")];
    enabled()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      const items = enabled();
      if (items.length === 0) return;
      const cur = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        e.key === "Home" ? 0
        : e.key === "End" ? items.length - 1
        : e.key === "ArrowDown" ? (cur + 1) % items.length
        : (cur - 1 + items.length) % items.length;
      items[next].focus();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [items]);

  return (
    <motion.div
      ref={ref}
      className="ctx-menu glass-e3"
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
      transition={springSnappy}
      role="menu"
    >
      {items.map((item, i) => {
        if (item.kind === "separator") return <div key={i} className="ctx-sep" />;
        if (item.kind === "heading")
          return (
            <div key={i} className="ctx-heading">
              {item.label}
            </div>
          );
        if (item.kind === "check")
          return (
            <button
              key={i}
              role="menuitemcheckbox"
              aria-checked={item.checked}
              className="ctx-item"
              onClick={() => {
                item.action();
                close();
              }}
            >
              <span className={`ctx-checkbox ${item.checked ? "ctx-checked" : ""}`}>
                {item.checked && (
                  <motion.span
                    style={{ display: "grid", placeItems: "center" }}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={springSnappy}
                  >
                    <Check size={11} strokeWidth={2.5} />
                  </motion.span>
                )}
              </span>
              <span className="ctx-label">{item.label}</span>
            </button>
          );
        return (
          <button
            key={i}
            role="menuitem"
            className={`ctx-item ${item.danger ? "ctx-danger" : ""}`}
            disabled={item.disabled}
            onClick={() => {
              item.action();
              close();
            }}
          >
            {item.icon && <span className="ctx-icon">{item.icon}</span>}
            <span className="ctx-label">{item.label}</span>
          </button>
        );
      })}
    </motion.div>
  );
}

export function ContextMenuHost() {
  const { open, x, y, items } = useMenuStore();
  const close = useMenuStore((s) => s.close);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onScroll = () => close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="ctx-backdrop"
            onClick={close}
            onContextMenu={(e) => {
              e.preventDefault();
              close();
            }}
          />
          <MenuPanel x={x} y={y} items={items} />
        </>
      )}
    </AnimatePresence>
  );
}
