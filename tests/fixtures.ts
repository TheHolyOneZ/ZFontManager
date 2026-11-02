import type { FontFace } from "../src/lib/ipc.ts";

const STYLES: [string, string, number, boolean][] = [
  ["ExtraLight", "ExtraLight", 200, false],
  ["ExtraLight Italic", "ExtraLightIt", 200, true],
  ["Light", "Light", 300, false],
  ["Light Italic", "LightIt", 300, true],
  ["Regular", "Regular", 400, false],
  ["Italic", "It", 400, true],
  ["Semibold", "Semibold", 600, false],
  ["Semibold Italic", "SemiboldIt", 600, true],
  ["Bold", "Bold", 700, false],
  ["Bold Italic", "BoldIt", 700, true],
  ["Black", "Black", 900, false],
  ["Black Italic", "BlackIt", 900, true],
];

export const TEXT = "Source Serif 4";
export const DISPLAY = "Source Serif 4 Display";

function family(name: string, psPrefix: string): FontFace[] {
  return STYLES.map(([style, psStyle, weight, italic]) => {
    const path = `/fonts/OTF/${psPrefix}-${psStyle}.otf`;
    return {
      id: `${path}#0`,
      path,
      previewPath: null,
      faceIndex: 0,
      family: name,
      style,
      postscriptName: `${psPrefix}-${psStyle}`,
      foundry: null,
      license: null,
      licenseUrl: null,
      format: "otf",
      isVariable: false,
      axes: [],
      weight,
      italic,
      monospaced: false,
      classification: "serif",
      scripts: [],
      features: [],
      glyphCount: 0,
      fileSize: 0,
      source: "user",
      installable: true,
      deactivatable: true,
      active: false,
    };
  });
}

export function library(): FontFace[] {
  return [...family(TEXT, "SourceSerif4"), ...family(DISPLAY, "SourceSerif4Display")];
}

export const of = (faces: FontFace[], name: string) => faces.filter((f) => f.family === name);
export const pathsOf = (faces: FontFace[]) => new Set(faces.map((f) => f.path));
export const need = (name: string, installed = false) => ({ name, installed });
