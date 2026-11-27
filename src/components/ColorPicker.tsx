import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Popover } from "../design/primitives/Popover";
import { hexToHsv, hsvToHex, normalizeHex, type Hsv } from "../lib/color";
import { useT } from "../lib/i18n";

function usePointerDrag(onPoint: (x: number, y: number) => void) {
  const handler = useRef(onPoint);
  handler.current = onPoint;
  return (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const apply = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      handler.current(
        Math.min(1, Math.max(0, (cx - r.left) / r.width)),
        Math.min(1, Math.max(0, (cy - r.top) / r.height)),
      );
    };
    apply(e.clientX, e.clientY);
    const move = (ev: PointerEvent) => apply(ev.clientX, ev.clientY);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
}

export function ColorPicker({
  value,
  onChange,
  swatches = [],
}: {
  value: string;
  onChange: (hex: string) => void;
  swatches?: string[];
}) {
  const t = useT();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [draft, setDraft] = useState(value);
  const last = useRef(value);

  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    const next = hexToHsv(value);
    setHsv((cur) => (next.s === 0 || next.v === 0 ? { ...next, h: cur.h } : next));
    setDraft(value);
  }, [value]);

  const emit = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    last.current = hex;
    setDraft(hex);
    onChange(hex);
  };

  const onPad = usePointerDrag((x, y) => emit({ h: hsv.h, s: x, v: 1 - y }));
  const onHue = usePointerDrag((x) => emit({ ...hsv, h: x * 360 }));

  const nudge = (e: React.KeyboardEvent, axis: "pad" | "hue") => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const k = e.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(k)) return;
    e.preventDefault();
    if (axis === "hue") {
      const dir = k === "ArrowLeft" || k === "ArrowDown" ? -1 : 1;
      emit({ ...hsv, h: (hsv.h + dir * step * 360 + 360) % 360 });
      return;
    }
    const s = hsv.s + (k === "ArrowRight" ? step : k === "ArrowLeft" ? -step : 0);
    const v = hsv.v + (k === "ArrowUp" ? step : k === "ArrowDown" ? -step : 0);
    emit({ h: hsv.h, s: Math.min(1, Math.max(0, s)), v: Math.min(1, Math.max(0, v)) });
  };

  const commitDraft = () => {
    const hex = normalizeHex(draft);
    if (!hex) {
      setDraft(value);
      return;
    }
    if (hex !== value) {
      last.current = hex;
      setHsv(hexToHsv(hex));
      onChange(hex);
    }
    setDraft(hex);
  };

  return (
    <div className="cpick" style={{ "--hue": hsv.h } as CSSProperties}>
      <div
        className="cpick-pad"
        role="slider"
        tabIndex={0}
        aria-label={t("color.saturation")}
        aria-valuetext={`${Math.round(hsv.s * 100)}% ${Math.round(hsv.v * 100)}%`}
        onPointerDown={onPad}
        onKeyDown={(e) => nudge(e, "pad")}
      >
        <span
          className="cpick-pad-knob"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
        />
      </div>
      <div
        className="cpick-hue"
        role="slider"
        tabIndex={0}
        aria-label={t("color.hue")}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={onHue}
        onKeyDown={(e) => nudge(e, "hue")}
      >
        <span className="cpick-hue-knob" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div className="cpick-row">
        <span className="cpick-preview" style={{ background: value }} />
        <input
          className="cpick-hex"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDraft();
          }}
          aria-label={t("color.hex")}
          spellCheck={false}
          maxLength={7}
        />
      </div>
      {swatches.length > 0 && (
        <div className="cpick-swatches">
          {swatches.map((sw) => (
            <button
              key={sw}
              className={`cpick-swatch ${sw === value ? "is-on" : ""}`}
              style={{ background: sw }}
              aria-label={sw}
              title={sw}
              onClick={() => {
                last.current = sw;
                setHsv(hexToHsv(sw));
                setDraft(sw);
                onChange(sw);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ColorField({
  value,
  onChange,
  label,
  swatches,
  modified = false,
  onReset,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
  swatches?: string[];
  modified?: boolean;
  onReset?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="color-field-wrap">
      {modified && onReset && (
        <button className="color-reset" onClick={onReset} title={t("color.reset")} aria-label={t("color.resetNamed", { name: label })}>
          <RotateCcw size={12} strokeWidth={1.8} />
        </button>
      )}
      <button
        ref={ref}
        className={`color-field ${open ? "is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("color.pickNamed", { name: label })}
        aria-expanded={open}
      >
        <span className="color-field-chip" style={{ background: value }} />
        <span className="color-field-hex">{value.toUpperCase()}</span>
      </button>
      <Popover anchorRef={ref} open={open} onClose={() => setOpen(false)} width={232} label={label}>
        <ColorPicker value={value} onChange={onChange} swatches={swatches} />
      </Popover>
    </div>
  );
}
