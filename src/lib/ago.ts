import type { useT } from "./i18n";

export function ago(fetchedAt: number, t: ReturnType<typeof useT>): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - fetchedAt);
  if (secs < 3600) return t("online.updatedMinutes", { count: Math.max(1, Math.floor(secs / 60)) });
  if (secs < 86400) return t("online.updatedHours", { count: Math.floor(secs / 3600) });
  return t("online.updatedDays", { count: Math.floor(secs / 86400) });
}
