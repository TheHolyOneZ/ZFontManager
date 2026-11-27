export const BROWSE_IDS = [
  "library",
  "favorites",
  "lastImported",
  "activated",
  "activatedSession",
  "deactivated",
  "system",
] as const;
export const SECTION_IDS = ["collections", "tags", "folders"] as const;
export const FOOTER_IDS = ["online", "trash", "about", "shortcuts"] as const;
export const SIDEBAR_IDS: string[] = [...BROWSE_IDS, ...SECTION_IDS, ...FOOTER_IDS];
export const SIDEBAR_DEFAULT_WIDTH = 248;
export const SIDEBAR_MIN_WIDTH = 188;
export const SIDEBAR_MAX_WIDTH = 420;

export function clampSidebarWidth(w: number): number {
  return Math.round(Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, w)));
}

export function normalizeOrder(raw: unknown, ids: readonly string[]): string[] {
  const list = Array.isArray(raw) ? raw.filter((n): n is string => typeof n === "string") : [];
  const known = list.filter((id, i) => ids.includes(id) && list.indexOf(id) === i);
  return [...known, ...ids.filter((id) => !known.includes(id))];
}

export function mergeOrder(full: string[], visibleNext: string[]): string[] {
  const visible = new Set(visibleNext);
  const queue = [...visibleNext];
  return full.map((id) => (visible.has(id) ? queue.shift()! : id));
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
