import { convertFileSrc } from "@tauri-apps/api/core";
import { ipc, type FontFace as ZFontFace } from "./ipc";
import { cssVarsFor, SYSTEM_FONT, tokensFor, type Appearance, type ThemeBase } from "./themeTokens";

export * from "./themeTokens";

let appliedKeys: string[] = [];

export function paintAppearance(app: Appearance, base: ThemeBase) {
  const root = document.documentElement;
  const vars = cssVarsFor(tokensFor(app, base), base);
  for (const key of appliedKeys) if (!(key in vars)) root.style.removeProperty(key);
  for (const [key, value] of Object.entries(vars)) {
    if (key === "color-scheme") root.style.colorScheme = value;
    else root.style.setProperty(key, value);
  }
  appliedKeys = Object.keys(vars);
  root.style.setProperty("--rs", String(app.radius));
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const uiFaces = new Map<string, globalThis.FontFace[]>();
let fontToken = 0;

function quote(name: string): string {
  return `"${name.replace(/["\\]/g, "\\$&")}"`;
}

async function loadFace(name: string, face: ZFontFace): Promise<globalThis.FontFace | null> {
  const wghtAxis = face.isVariable ? face.axes.find((a) => a.tag === "wght") : undefined;
  const descriptors: FontFaceDescriptors = {
    weight: wghtAxis ? `${Math.round(wghtAxis.min)} ${Math.round(wghtAxis.max)}` : String(face.weight || 400),
    style: face.italic ? "italic" : "normal",
  };
  const path = face.previewPath ?? face.path;
  try {
    const ff = new globalThis.FontFace(name, `url("${convertFileSrc(path)}")`, descriptors);
    await ff.load();
    return ff;
  } catch {
  }
  try {
    const bytes = await ipc.getPreviewFont(path, face.faceIndex ?? 0);
    const ff = new globalThis.FontFace(name, bytes, descriptors);
    await ff.load();
    return ff;
  } catch {
    return null;
  }
}

export function facesForFamily(family: string, fonts: ZFontFace[]): ZFontFace[] {
  const faces = fonts.filter((f) => f.family === family);
  const picked: ZFontFace[] = [];
  const seen = new Set<string>();
  for (const f of faces.sort((a, b) => Number(a.isVariable) - Number(b.isVariable))) {
    const key = `${f.isVariable ? "var" : f.weight}-${f.italic}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(f);
  }
  return picked.slice(0, 12);
}

export async function applyUiFont(family: string | null, fonts: ZFontFace[]): Promise<boolean> {
  const root = document.documentElement;
  const token = ++fontToken;
  if (!family) {
    root.style.removeProperty("--font-lead");
    return true;
  }
  if (family === SYSTEM_FONT) {
    root.style.setProperty("--font-lead", "system-ui");
    return true;
  }
  const name = `zfm-ui-${hash(family)}`;
  if (!uiFaces.has(name)) {
    const faces = facesForFamily(family, fonts);
    if (faces.length === 0) {
      root.style.setProperty("--font-lead", quote(family));
      return false;
    }
    const loaded = (await Promise.all(faces.map((f) => loadFace(name, f)))).filter(
      (f): f is globalThis.FontFace => f !== null,
    );
    if (loaded.length === 0) {
      if (token === fontToken) root.style.setProperty("--font-lead", quote(family));
      return false;
    }
    loaded.forEach((f) => document.fonts.add(f));
    uiFaces.set(name, loaded);
  }
  if (token !== fontToken) return true;
  root.style.setProperty("--font-lead", `${quote(name)}, ${quote(family)}`);
  return true;
}
