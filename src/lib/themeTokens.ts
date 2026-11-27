import { contrast, hexToRgb, mix, normalizeHex, readableOn, rgbTriplet } from "./color.ts";

export type ThemeBase = "dark" | "light";

export const TOKEN_GROUPS = {
  surfaces: ["canvas", "toolbar", "sidebar", "card", "panel", "field", "line"],
  text: ["text", "textMuted", "specimen"],
  accent: ["accent", "accentText", "selection", "focus"],
  controls: ["toggleOn", "toggleOff", "toggleThumb", "slider", "scrollbar"],
  status: ["success", "warning", "error"],
  badges: ["badgeOtf", "badgeTtf", "badgeWoff", "badgeVariable"],
  overlay: ["scrim"],
} as const;

export type TokenGroup = keyof typeof TOKEN_GROUPS;
export type TokenKey = (typeof TOKEN_GROUPS)[TokenGroup][number];
export type Tokens = Record<TokenKey, string>;

export const TOKEN_KEYS = Object.values(TOKEN_GROUPS).flat() as TokenKey[];

interface Seed {
  canvas: string;
  text: string;
  accent: string;
  accentText?: string;
  extra?: Partial<Tokens>;
}

export interface Preset {
  id: string;
  name: string;
  base: ThemeBase;
  seed: Seed;
  swatches: string[];
}

export const PRESETS: Preset[] = [
  {
    id: "ink",
    name: "Ink",
    base: "dark",
    seed: { canvas: "#0e0d12", text: "#e9e7ef", accent: "#9d8ff4", accentText: "#15112b" },
    swatches: ["#9d8ff4", "#6fb1ff", "#5fd0b5", "#f0b45b", "#f07a8c"],
  },
  {
    id: "graphite",
    name: "Graphite",
    base: "dark",
    seed: { canvas: "#151515", text: "#e7e7e7", accent: "#d6d6d6", accentText: "#151515" },
    swatches: ["#d6d6d6", "#9d8ff4", "#6fb1ff", "#7ed1a5", "#f08a6c"],
  },
  {
    id: "darkroom",
    name: "Darkroom",
    base: "dark",
    seed: {
      canvas: "#060606",
      text: "#ece3db",
      accent: "#f0a53a",
      accentText: "#1a1006",
      extra: { warning: "#f5c451" },
    },
    swatches: ["#f0a53a", "#e8564a", "#d9d2c5", "#8fc0a9", "#b9a3f0"],
  },
  {
    id: "blueprint",
    name: "Blueprint",
    base: "dark",
    seed: { canvas: "#0b1524", text: "#dde7f4", accent: "#72b3ff", accentText: "#06121f" },
    swatches: ["#72b3ff", "#9fe3ff", "#ffd166", "#ff8fa3", "#b8a6ff"],
  },
  {
    id: "paper",
    name: "Paper",
    base: "light",
    seed: { canvas: "#f3f2f6", text: "#1c1a24", accent: "#4f43a8", accentText: "#ffffff" },
    swatches: ["#4f43a8", "#1f6fd1", "#0f8a6c", "#b5551d", "#c2335b"],
  },
  {
    id: "letterpress",
    name: "Letterpress",
    base: "light",
    seed: { canvas: "#fafaf8", text: "#161616", accent: "#161616", accentText: "#fafaf8" },
    swatches: ["#161616", "#4f43a8", "#1f6fd1", "#b42f2f", "#0f7a5c"],
  },
  {
    id: "riso",
    name: "Riso",
    base: "light",
    seed: { canvas: "#f5f5f2", text: "#1d2a4d", accent: "#e8408f", accentText: "#ffffff" },
    swatches: ["#e8408f", "#0078bf", "#ff6c2f", "#00a95c", "#765ba7"],
  },
  {
    id: "process",
    name: "Process",
    base: "light",
    seed: { canvas: "#f2f6f8", text: "#0f1e26", accent: "#0089c4", accentText: "#ffffff" },
    swatches: ["#0089c4", "#d6007f", "#e0b000", "#1d1d1b", "#4f43a8"],
  },
];

export const DEFAULT_DARK = "ink";
export const DEFAULT_LIGHT = "paper";

export function presetById(id: string | undefined, base: ThemeBase): Preset {
  const hit = PRESETS.find((p) => p.id === id && p.base === base);
  if (hit) return hit;
  return PRESETS.find((p) => p.id === (base === "dark" ? DEFAULT_DARK : DEFAULT_LIGHT))!;
}

export interface PresetCustom {
  accent?: string;
  tokens?: Partial<Tokens>;
}

export type EditorMode = "simple" | "advanced";

export interface Appearance {
  darkPreset: string;
  lightPreset: string;
  custom: Record<string, PresetCustom>;
  font: string | null;
  radius: number;
  editor: EditorMode;
}

export const RADIUS_STEPS = [0, 0.5, 1, 1.6] as const;

export const DEFAULT_APPEARANCE: Appearance = {
  darkPreset: DEFAULT_DARK,
  lightPreset: DEFAULT_LIGHT,
  custom: {},
  font: null,
  radius: 1,
  editor: "simple",
};

export const SYSTEM_FONT = "\u0000system";

function cleanTokens(raw: unknown): Partial<Tokens> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Tokens> = {};
  for (const key of TOKEN_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string") {
      const hex = normalizeHex(v);
      if (hex) out[key] = hex;
    }
  }
  return out;
}

export function parseAppearance(raw: unknown): Appearance {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_APPEARANCE };
  const r = raw as Record<string, unknown>;
  const custom: Record<string, PresetCustom> = {};
  if (r.custom && typeof r.custom === "object") {
    for (const [id, value] of Object.entries(r.custom as Record<string, unknown>)) {
      if (!PRESETS.some((p) => p.id === id) || !value || typeof value !== "object") continue;
      const v = value as Record<string, unknown>;
      const accent = typeof v.accent === "string" ? normalizeHex(v.accent) : null;
      const tokens = cleanTokens(v.tokens);
      const entry: PresetCustom = {};
      if (accent) entry.accent = accent;
      if (Object.keys(tokens).length > 0) entry.tokens = tokens;
      if (entry.accent || entry.tokens) custom[id] = entry;
    }
  }
  const radius = typeof r.radius === "number" && Number.isFinite(r.radius) ? Math.min(2, Math.max(0, r.radius)) : 1;
  return {
    darkPreset: typeof r.darkPreset === "string" ? presetById(r.darkPreset, "dark").id : DEFAULT_DARK,
    lightPreset: typeof r.lightPreset === "string" ? presetById(r.lightPreset, "light").id : DEFAULT_LIGHT,
    custom,
    font: typeof r.font === "string" && r.font.length > 0 ? r.font : null,
    radius,
    editor: r.editor === "advanced" ? "advanced" : "simple",
  };
}

export function deriveTokens(preset: Preset, custom?: PresetCustom): Tokens {
  const { canvas, text } = preset.seed;
  const dark = preset.base === "dark";
  const accent = custom?.accent ?? preset.seed.accent;
  const accentText =
    custom?.accent && custom.accent !== preset.seed.accent
      ? readableOn(accent, mix(text, "#000000", 0.2), "#ffffff")
      : (preset.seed.accentText ?? readableOn(accent));
  const thumb = contrast("#ffffff", accent) >= 1.5 ? "#ffffff" : canvas;

  const base: Tokens = dark
    ? {
        canvas,
        toolbar: mix(text, canvas, 0.02),
        sidebar: mix(text, canvas, 0.024),
        card: mix(text, canvas, 0.045),
        panel: mix(text, canvas, 0.06),
        field: mix(text, canvas, 0.05),
        line: mix(text, canvas, 0.095),
        text,
        textMuted: mix(text, canvas, 0.62),
        specimen: text,
        accent,
        accentText,
        selection: accent,
        focus: accent,
        toggleOn: accent,
        toggleOff: mix(text, canvas, 0.16),
        toggleThumb: thumb,
        slider: accent,
        scrollbar: mix(text, canvas, 0.2),
        success: "#4ade80",
        warning: "#fbbf24",
        error: "#f87171",
        badgeOtf: "#60a5fa",
        badgeTtf: "#4ade80",
        badgeWoff: "#fbbf24",
        badgeVariable: accent,
        scrim: canvas,
      }
    : {
        canvas,
        toolbar: mix("#ffffff", canvas, 0.4),
        sidebar: mix(text, canvas, 0.03),
        card: mix("#ffffff", canvas, 0.85),
        panel: mix("#ffffff", canvas, 0.92),
        field: mix("#ffffff", canvas, 0.7),
        line: mix(text, canvas, 0.12),
        text,
        textMuted: mix(text, canvas, 0.64),
        specimen: text,
        accent,
        accentText,
        selection: accent,
        focus: accent,
        toggleOn: accent,
        toggleOff: mix(text, canvas, 0.2),
        toggleThumb: thumb,
        slider: accent,
        scrollbar: mix(text, canvas, 0.24),
        success: "#15803d",
        warning: "#b45309",
        error: "#dc2626",
        badgeOtf: "#2563eb",
        badgeTtf: "#15803d",
        badgeWoff: "#b45309",
        badgeVariable: accent,
        scrim: mix(text, "#000000", 0.5),
      };

  return { ...base, ...(preset.seed.extra ?? {}), ...(custom?.tokens ?? {}) };
}

const VAR: Record<TokenKey, string> = {
  canvas: "--canvas",
  toolbar: "--toolbar-bg",
  sidebar: "--sidebar-bg",
  card: "--card-bg",
  panel: "--panel-bg",
  field: "--field-bg",
  line: "--line",
  text: "--text-primary",
  textMuted: "--text-secondary",
  specimen: "--specimen",
  accent: "--accent",
  accentText: "--accent-ink",
  selection: "--selection",
  focus: "--focus",
  toggleOn: "--toggle-on",
  toggleOff: "--toggle-off",
  toggleThumb: "--toggle-thumb",
  slider: "--slider",
  scrollbar: "--scrollbar",
  success: "--success",
  warning: "--warning",
  error: "--error",
  badgeOtf: "--badge-otf",
  badgeTtf: "--badge-ttf",
  badgeWoff: "--badge-woff",
  badgeVariable: "--badge-variable",
  scrim: "--scrim",
};

export function cssVarsFor(tokens: Tokens, base: ThemeBase): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of TOKEN_KEYS) vars[VAR[key]] = tokens[key];
  vars["--ink-rgb"] = rgbTriplet(tokens.text);
  vars["--scrim-rgb"] = rgbTriplet(tokens.scrim);
  vars["--accent-rgb"] = rgbTriplet(tokens.accent);
  vars["--text-tertiary"] = mix(tokens.textMuted, tokens.canvas, 0.66);
  vars["--text-disabled"] = mix(tokens.textMuted, tokens.canvas, 0.4);
  vars["--line-strong"] = mix(tokens.text, tokens.line, 0.14);
  vars["--line-soft"] = mix(tokens.line, tokens.canvas, 0.6);
  vars["--tooltip-bg"] = tokens.panel;
  const { r, g, b } = hexToRgb(tokens.canvas);
  vars["--canvas-rgb"] = `${r}, ${g}, ${b}`;
  vars["color-scheme"] = base;
  return vars;
}

export function resolvedPreset(app: Appearance, base: ThemeBase): Preset {
  return presetById(base === "dark" ? app.darkPreset : app.lightPreset, base);
}

export function tokensFor(app: Appearance, base: ThemeBase): Tokens {
  const preset = resolvedPreset(app, base);
  return deriveTokens(preset, app.custom[preset.id]);
}

export function themeToJson(app: Appearance, base: ThemeBase): string {
  const preset = resolvedPreset(app, base);
  return JSON.stringify(
    { zfontmanagerTheme: 1, base, preset: preset.id, tokens: tokensFor(app, base) },
    null,
    2,
  );
}

export function themeFromJson(text: string): { base: ThemeBase; preset: string; tokens: Partial<Tokens> } | null {
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (!data || typeof data !== "object" || data.zfontmanagerTheme !== 1) return null;
    const base: ThemeBase = data.base === "light" ? "light" : "dark";
    const preset = presetById(typeof data.preset === "string" ? data.preset : undefined, base).id;
    const tokens = cleanTokens(data.tokens);
    if (Object.keys(tokens).length === 0) return null;
    return { base, preset, tokens };
  } catch {
    return null;
  }
}
