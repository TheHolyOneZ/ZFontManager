import { invoke } from "@tauri-apps/api/core";

export type FontFormat = "otf" | "ttf" | "woff" | "woff2" | "unknown";
export type FontSource = "system" | "user" | "managed";
export type Classification = "serif" | "sans" | "mono" | "display" | "script" | "unknown";

export interface VariationAxis {
  tag: string;
  min: number;
  default: number;
  max: number;
}

export interface FontFace {
  id: string;
  path: string;
  faceIndex: number;
  family: string;
  style: string;
  postscriptName: string | null;
  foundry: string | null;
  license: string | null;
  licenseUrl: string | null;
  format: FontFormat;
  isVariable: boolean;
  axes: VariationAxis[];
  weight: number;
  italic: boolean;
  monospaced: boolean;
  classification: Classification;
  scripts: string[];
  fileSize: number;
  source: FontSource;
  deactivatable: boolean;
  active: boolean;
}

export interface TrashEntry {
  id: string;
  originalPath: string;
  trashedPath: string;
  family: string;
  trashedAt: number;
}

export interface InstallResult {
  installed: FontFace[];
  errors: string[];
}

export interface ScanProgress {
  done: number;
  total: number;
}

export interface InstallProgress {
  file: string;
  done: number;
  total: number;
  ok: boolean;
  error: string | null;
}

export interface AppSettings {
  extraDirs: string[];
  watchEnabled: boolean;
}

export const ipc = {
  getSettings: () => invoke<AppSettings>("get_settings"),
  setSettings: (settings: AppSettings) => invoke<void>("set_settings", { settings }),
  scanFonts: () => invoke<FontFace[]>("scan_fonts"),
  setFontActive: (path: string, active: boolean) =>
    invoke<void>("set_font_active", { path, active }),
  setFontsActive: (paths: string[], active: boolean) =>
    invoke<void>("set_fonts_active", { paths, active }),
  setFontsActiveSession: (paths: string[]) =>
    invoke<void>("set_fonts_active_session", { paths }),
  installFonts: (paths: string[]) => invoke<InstallResult>("install_fonts", { paths }),
  uninstallFont: (path: string, family: string) =>
    invoke<TrashEntry>("uninstall_font", { path, family }),
  listTrash: () => invoke<TrashEntry[]>("list_trash"),
  restoreFromTrash: (entryId: string) => invoke<void>("restore_from_trash", { entryId }),
  deleteTrashEntry: (entryId: string) => invoke<void>("delete_trash_entry", { entryId }),
  emptyTrash: () => invoke<void>("empty_trash"),
  getTags: () => invoke<Record<string, string[]>>("get_tags"),
  setTags: (family: string, tags: string[]) => invoke<void>("set_tags", { family, tags }),
  getFavorites: () => invoke<string[]>("get_favorites"),
  getNotes: () => invoke<Record<string, string>>("get_notes"),
  setNote: (family: string, note: string) => invoke<void>("set_note", { family, note }),
  setFavorite: (family: string, favorite: boolean) =>
    invoke<void>("set_favorite", { family, favorite }),
  getCharset: (path: string, faceIndex: number) =>
    invoke<number[]>("get_charset", { path, faceIndex }),
  getFeatures: (path: string, faceIndex: number) =>
    invoke<string[]>("get_features", { path, faceIndex }),
  readTextFile: (path: string) => invoke<string>("read_text_file", { path }),
  writeBinaryFile: (path: string, data: number[]) =>
    invoke<void>("write_binary_file", { path, data }),
  getCollections: () => invoke<Record<string, string[]>>("get_collections"),
  setCollection: (name: string, families: string[]) =>
    invoke<void>("set_collection", { name, families }),
  deleteCollection: (name: string) => invoke<void>("delete_collection", { name }),
  renameCollection: (from: string, to: string) =>
    invoke<void>("rename_collection", { from, to }),
  exportFont: (src: string, dest: string) => invoke<void>("export_font", { src, dest }),
  writeTextFile: (path: string, content: string) =>
    invoke<void>("write_text_file", { path, content }),
  exportFonts: (paths: string[], destDir: string) =>
    invoke<number>("export_fonts", { paths, destDir }),
  getPrefs: () => invoke<Record<string, unknown> | null>("get_prefs"),
  setPrefs: (prefs: Record<string, unknown>) => invoke<void>("set_prefs", { prefs }),
};
