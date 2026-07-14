export type ThemePref = "dark" | "light" | "system";

const query = window.matchMedia("(prefers-color-scheme: light)");
let followingSystem = false;

function resolve(pref: ThemePref): "dark" | "light" {
  if (pref === "system") return query.matches ? "light" : "dark";
  return pref;
}

function stamp(theme: "dark" | "light") {
  document.documentElement.dataset.theme = theme;
}

query.addEventListener("change", () => {
  if (followingSystem) stamp(resolve("system"));
});

let switchTimer: number | undefined;

export function applyTheme(pref: ThemePref, animate = false) {
  followingSystem = pref === "system";
  if (animate) {
    const root = document.documentElement;
    root.classList.add("theme-switching");
    window.clearTimeout(switchTimer);
    switchTimer = window.setTimeout(
      () => root.classList.remove("theme-switching"),
      400,
    );
  }
  stamp(resolve(pref));
}
