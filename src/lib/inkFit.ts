import { useMemo, type CSSProperties } from "react";

export interface InkMetrics {
  width: number;
  actualBoundingBoxAscent: number;
  actualBoundingBoxDescent: number;
  actualBoundingBoxLeft: number;
  actualBoundingBoxRight: number;
  fontBoundingBoxAscent?: number;
  fontBoundingBoxDescent?: number;
}

export interface InkPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function inkOverflow(m: InkMetrics, size: number, lineHeight: number): InkPadding {
  const ascent = m.fontBoundingBoxAscent ?? size * 0.8;
  const descent = m.fontBoundingBoxDescent ?? size * 0.2;
  const line = size * lineHeight;
  const baseline = (line - (ascent + descent)) / 2 + ascent;
  const past = (amount: number) => Math.max(0, Math.ceil(amount));
  return {
    top: past(m.actualBoundingBoxAscent - baseline),
    bottom: past(m.actualBoundingBoxDescent - (line - baseline)),
    left: past(m.actualBoundingBoxLeft),
    right: past(m.actualBoundingBoxRight - m.width),
  };
}

const MAX_CACHED = 4000;
const cache = new Map<string, CSSProperties | undefined>();
let context: CanvasRenderingContext2D | null | undefined;

function measure(font: string, text: string): InkMetrics | null {
  if (context === undefined) context = document.createElement("canvas").getContext("2d");
  if (!context) return null;
  context.font = font;
  return context.measureText(text);
}

export function useInkPadding(
  fontFamily: string | null,
  text: string,
  size: number,
  lineHeight: number,
  italic = false,
  weight?: number,
): CSSProperties | undefined {
  return useMemo(() => {
    if (!fontFamily || !text) return undefined;
    const font = `${italic ? "italic " : ""}${weight ?? 400} ${size}px "${fontFamily}"`;
    const key = `${font}|${lineHeight}|${text}`;
    if (cache.has(key)) return cache.get(key);
    const metrics = measure(font, text);
    if (!metrics) return undefined;
    const pad = inkOverflow(metrics, size, lineHeight);
    const style =
      pad.top + pad.right + pad.bottom + pad.left > 0
        ? {
            paddingTop: pad.top,
            paddingRight: pad.right,
            paddingBottom: pad.bottom,
            paddingLeft: pad.left,
          }
        : undefined;
    if (cache.size >= MAX_CACHED) cache.clear();
    cache.set(key, style);
    return style;
  }, [fontFamily, text, size, lineHeight, italic, weight]);
}
