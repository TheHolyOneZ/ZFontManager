import { createContext, useContext, type ReactNode } from "react";

export const SettingsQuery = createContext("");

export function matchesQuery(query: string, ...texts: (string | undefined)[]): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return true;
  return texts.some((t) => t?.toLocaleLowerCase().includes(q));
}

export function Group({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="set-group">
      {(title || aside) && (
        <div className="set-group-head">
          {title && <h3 className="set-group-title">{title}</h3>}
          {aside}
        </div>
      )}
      <div className="set-rows">{children}</div>
    </section>
  );
}

export function Row({
  label,
  sub,
  keywords,
  stack = false,
  children,
  className = "",
}: {
  label: ReactNode;
  sub?: ReactNode;
  keywords?: string;
  stack?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const query = useContext(SettingsQuery);
  const text = [typeof label === "string" ? label : "", typeof sub === "string" ? sub : "", keywords];
  if (!matchesQuery(query, ...text)) return null;
  return (
    <div className={`set-row ${stack ? "set-row-stack" : ""} ${className}`}>
      <div className="set-row-text">
        <div className="set-label">{label}</div>
        {sub && <div className="set-sub">{sub}</div>}
      </div>
      {children !== undefined && <div className="set-control">{children}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={`seg-btn ${o.value === value ? "is-on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
