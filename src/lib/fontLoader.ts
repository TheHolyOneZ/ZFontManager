import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { ipc, type FontFace as ZFontFace } from "./ipc";

type LoadState = "loading" | "loaded" | "failed";
const cache = new Map<string, LoadState>();
const listeners = new Map<string, Set<() => void>>();

function cssName(face: ZFontFace): string {
  return `zfm-${hash(face.id)}`;
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function ensureLoaded(face: ZFontFace): void {
  ensurePathLoaded(cssName(face), face.previewPath ?? face.path, face);
}

function loadSource(name: string, source: string | ArrayBuffer): Promise<void> {
  const ff = new FontFace(name, source);
  return ff.load().then(() => {
    document.fonts.add(ff);
  });
}

function systemSources(face: ZFontFace): string {
  const names = [face.postscriptName, `${face.family} ${face.style}`];
  if (/^(regular|normal|book|roman)$/i.test(face.style)) names.push(face.family);
  return names
    .filter((n): n is string => Boolean(n))
    .map((n) => `local("${n.replace(/["\\]/g, "\\$&")}")`)
    .join(", ");
}

function ensurePathLoaded(name: string, path: string, face?: ZFontFace): void {
  if (cache.has(name)) return;
  cache.set(name, "loading");

  loadSource(name, `url("${convertFileSrc(path)}")`)
    .catch(() =>
      ipc.getPreviewFont(path, face?.faceIndex ?? 0).then((bytes) => loadSource(name, bytes)),
    )
    .catch((e) => {
      if (!face?.active) throw e;
      return loadSource(name, systemSources(face));
    })
    .then(() => {
      cache.set(name, "loaded");
    })
    .catch(() => {
      cache.set(name, "failed");
    })
    .finally(() => {
      listeners.get(name)?.forEach((fn) => fn());
      listeners.delete(name);
    });
}

export function useFontCss(face: ZFontFace | null): {
  fontFamily: string | null;
  failed: boolean;
} {
  const name = face ? cssName(face) : null;
  const [, bump] = useState(0);

  useEffect(() => {
    if (!face || !name) return;
    ensureLoaded(face);
    if (cache.get(name) === "loading") {
      const set = listeners.get(name) ?? new Set();
      const fn = () => bump((n) => n + 1);
      set.add(fn);
      listeners.set(name, set);
      return () => {
        set.delete(fn);
      };
    }
  }, [face, name]);

  const state = name ? cache.get(name) : undefined;
  return {
    fontFamily: state === "loaded" && name ? name : null,
    failed: state === "failed",
  };
}

export function usePathFontCss(key: string | null, path: string | null): string | null {
  const name = key ? `zfm-p-${hash(key)}` : null;
  const [, bump] = useState(0);

  useEffect(() => {
    if (!name || !path) return;
    ensurePathLoaded(name, path);
    if (cache.get(name) === "loading") {
      const set = listeners.get(name) ?? new Set();
      const fn = () => bump((n) => n + 1);
      set.add(fn);
      listeners.set(name, set);
      return () => {
        set.delete(fn);
      };
    }
  }, [name, path]);

  return name && path && cache.get(name) === "loaded" ? name : null;
}

export function loadFaceCss(face: ZFontFace): Promise<string> {
  const name = cssName(face);
  ensureLoaded(face);
  const state = cache.get(name);
  if (state === "loaded") return Promise.resolve(name);
  if (state === "failed") return Promise.reject(new Error("font failed to load"));
  return new Promise((resolve, reject) => {
    const set = listeners.get(name) ?? new Set();
    set.add(() => {
      if (cache.get(name) === "loaded") resolve(name);
      else reject(new Error("font failed to load"));
    });
    listeners.set(name, set);
  });
}

export function pathBasename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
