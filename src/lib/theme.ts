import { DEFAULT_APPEARANCE, paintAppearance, type Appearance, type ThemeBase } from "./appearance";

export type ThemePref = "dark" | "light" | "system";

const query = window.matchMedia("(prefers-color-scheme: light)");
let followingSystem = false;
let current: Appearance = DEFAULT_APPEARANCE;
let currentPref: ThemePref = "dark";

export function resolveTheme(pref: ThemePref): ThemeBase {
  if (pref === "system") return query.matches ? "light" : "dark";
  return pref;
}

function stamp(theme: ThemeBase) {
  document.documentElement.dataset.theme = theme;
  paintAppearance(current, theme);
}

query.addEventListener("change", () => {
  if (followingSystem) stamp(resolveTheme("system"));
});

let switchTimer: number | undefined;

function animateSwitch() {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  window.clearTimeout(switchTimer);
  switchTimer = window.setTimeout(() => root.classList.remove("theme-switching"), 400);
}

export function applyTheme(pref: ThemePref, animate = false) {
  followingSystem = pref === "system";
  currentPref = pref;
  if (animate) animateSwitch();
  stamp(resolveTheme(pref));
}

export function applyAppearance(app: Appearance, animate = false) {
  current = app;
  if (animate) animateSwitch();
  stamp(resolveTheme(currentPref));
}
