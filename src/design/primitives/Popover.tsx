import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { springSnappy } from "../springs";

const MARGIN = 10;
const GAP = 6;

interface Props {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width: number;
  className?: string;
  label: string;
  children: ReactNode;
}

interface Box {
  left: number;
  top: number;
  above: boolean;
}

export function Popover({ anchorRef, open, onClose, width, className = "", label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    if (!open) {
      setBox(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const height = ref.current?.offsetHeight ?? 320;
      const below = anchor.bottom + GAP;
      const above = below + height + MARGIN > window.innerHeight && anchor.top - GAP - height >= MARGIN;
      setBox({
        above,
        left: Math.min(Math.max(MARGIN, anchor.right - width), window.innerWidth - width - MARGIN),
        top: above
          ? anchor.top - GAP - height
          : Math.min(below, Math.max(MARGIN, window.innerHeight - height - MARGIN)),
      });
    };
    place();
    const id = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || anchorRef.current?.contains(target)) return;
      close.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      close.current();
      anchorRef.current?.focus();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, anchorRef]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="dialog"
          aria-label={label}
          className={`popover glass-e3 ${className}`}
          style={{
            width,
            left: box?.left ?? -9999,
            top: box?.top ?? -9999,
            transformOrigin: box?.above ? "bottom right" : "top right",
          }}
          initial={{ opacity: 0, scale: 0.97, y: box?.above ? 4 : -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
          transition={springSnappy}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
