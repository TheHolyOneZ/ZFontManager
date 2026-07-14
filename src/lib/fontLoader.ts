

import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import type { FontFace as ZFontFace } from "./ipc";

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
  const name = cssName(face);
  if (cache.has(name)) return;
  cache.set(name, "loading");

  const url = convertFileSrc(face.path);
  const ff = new FontFace(name, `url("${url}")`);
  ff.load()
    .then(() => {
      document.fonts.add(ff);
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
