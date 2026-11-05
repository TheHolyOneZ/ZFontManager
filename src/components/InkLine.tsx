import type { CSSProperties, ReactNode } from "react";
import { useInkPadding } from "../lib/inkFit";

export function InkLine({
  className,
  fontFamily,
  text,
  size,
  lineHeight,
  italic,
  style,
  children,
}: {
  className: string;
  fontFamily: string | null;
  text: string;
  size: number;
  lineHeight: number;
  italic: boolean;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ink = useInkPadding(fontFamily, text, size, lineHeight, italic);
  return (
    <p className={className} style={{ ...style, ...ink }}>
      {children}
    </p>
  );
}
