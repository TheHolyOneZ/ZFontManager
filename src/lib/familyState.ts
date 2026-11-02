import type { FontFace } from "./ipc";

export interface FamilyActivation {
  active: boolean;
  partial: boolean;
  activeCount: number;
}

export interface StyleGroup {
  key: string;
  style: string;
  weight: number;
  italic: boolean;
  faces: FontFace[];
  lead: FontFace;
  formats: string[];
  webOnly: boolean;
  deactivatable: boolean;
  active: boolean;
  partial: boolean;
}

const FORMAT_RANK: Record<string, number> = { otf: 0, ttf: 1, woff2: 2, woff: 3 };

export const isWebFormat = (format: string) => format === "woff" || format === "woff2";

export function familyActivation(faces: FontFace[]): FamilyActivation {
  const counted = faces.filter((f) => f.installable !== false);
  const activeCount = counted.filter((f) => f.active).length;
  const active = counted.length > 0 && activeCount === counted.length;
  return { active, partial: activeCount > 0 && !active, activeCount };
}

export function pathsToToggle(faces: FontFace[], active: boolean): string[] {
  const paths = faces
    .filter((f) => f.deactivatable && f.active !== active)
    .map((f) => f.path);
  return [...new Set(paths)];
}

export function styleKey(face: FontFace): string {
  return `${face.weight}|${face.italic ? 1 : 0}|${face.style.trim().toLowerCase()}`;
}

export function styleGroups(faces: FontFace[]): StyleGroup[] {
  const byKey = new Map<string, FontFace[]>();
  for (const face of faces) {
    const key = styleKey(face);
    const list = byKey.get(key);
    if (list) list.push(face);
    else byKey.set(key, [face]);
  }
  const groups: StyleGroup[] = [];
  for (const [key, list] of byKey) {
    const sorted = [...list].sort(
      (a, b) =>
        Number(b.installable !== false) - Number(a.installable !== false) ||
        (FORMAT_RANK[a.format] ?? 9) - (FORMAT_RANK[b.format] ?? 9),
    );
    const formats = [...new Set(sorted.map((f) => f.format))];
    const state = familyActivation(sorted);
    groups.push({
      key,
      style: sorted[0].style,
      weight: sorted[0].weight,
      italic: sorted[0].italic,
      faces: sorted,
      lead: sorted[0],
      formats,
      webOnly: sorted.every((f) => f.installable === false),
      deactivatable: sorted.some((f) => f.deactivatable),
      active: state.active,
      partial: state.partial,
    });
  }
  return groups.sort((a, b) => a.weight - b.weight || Number(a.italic) - Number(b.italic));
}
