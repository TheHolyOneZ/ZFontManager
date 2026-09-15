import type { FontFace } from "./ipc";

export interface AffinityFontNeed {
  name: string;
  installed: boolean;
}

export interface AffinityDoc {
  title: string;
  path: string;
  fonts: AffinityFontNeed[];
}

export interface AffinityEvent {
  kind: "needs" | "deactivated" | "error" | string;
  docs: AffinityDoc[];
  message: string | null;
}

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();

/**
 * Match Affinity font names (PostScript-style, e.g. "Montserrat-Bold")
 * to library file paths. Already-installed fonts are skipped.
 */
export function matchAffinityFonts(faces: FontFace[], needs: AffinityFontNeed[]): string[] {
  const paths: string[] = [];
  for (const need of needs) {
    if (need.installed) continue;
    const want = need.name.trim();
    if (!want) continue;
    let face = faces.find((f) => lower(f.postscriptName) === lower(want));
    if (!face && want.includes("-")) {
      const idx = want.indexOf("-");
      const fam = want.slice(0, idx).trim();
      const style = want.slice(idx + 1).trim();
      face = faces.find(
        (f) => lower(f.family) === lower(fam) && lower(f.style) === lower(style),
      );
    }
    if (!face) {
      const fam = want.includes("-")
        ? want.slice(0, want.indexOf("-")).trim()
        : want;
      const inFam = faces.filter((f) => lower(f.family) === lower(fam));
      face = inFam.find((f) => lower(f.style) === "regular") ?? inFam[0];
    }
    if (face && !paths.includes(face.path)) paths.push(face.path);
  }
  return paths;
}
