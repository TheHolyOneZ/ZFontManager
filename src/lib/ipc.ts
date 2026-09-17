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

  previewPath: string | null;
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
  duplicates: string[];
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

export type AdobeApp = "photoshop" | "illustrator";

export interface AppSettings {
  extraDirs: string[];
  watchEnabled: boolean;
  autoActivateImports: boolean;
  libraryDir: string | null;
  libraryDirEnabled: boolean;
  affinityEnabled: boolean;
  affinityDeactivateOnQuit: boolean;
  onlineFontsEnabled: boolean;
}

export interface OnlineFamily {
  id: string;
  family: string;
  category: string;
  weights: number[];
  styles: string[];
  subsets: string[];
  variable: boolean;
  license: string;
  lastModified: string;
}

export interface OnlineCatalogue {
  fetchedAt: number;
  fromCache: boolean;
  families: OnlineFamily[];
}

export interface OnlineFile {
  name: string;
  style: string;
  weight: number;
  filename: string;
  postScriptName: string;
  fullName: string;
  copyright: string;
}

export interface OnlineFamilyDetail {
  id: string;
  family: string;
  designer: string;
  category: string;
  license: string;
  licenseName: string;
  licenseUrl: string;
  reservedFontName: string | null;
  copyright: string;
  files: OnlineFile[];
  licenseText: string;
  sourceDir: string;
}

export interface OnlineDownloadResult {
  family: string;
  paths: string[];
  licensePath: string;
}

export interface OnlineProgress {
  id: string;
  file: string;
  done: number;
  total: number;
}

export interface AffinityConnection {
  reachable: boolean;
  version: string | null;
  docCount: number;
  error: string | null;
}

export type InstallMode = "link" | "move";

export const ipc = {
  getSettings: () => invoke<AppSettings>("get_settings"),
  setSettings: (settings: AppSettings) => invoke<void>("set_settings", { settings }),
  defaultLibraryDir: () => invoke<string>("default_library_dir"),
  affinityConnection: () => invoke<AffinityConnection>("affinity_connection"),
  affinitySessionActivate: (paths: string[]) =>
    invoke<string[]>("affinity_session_activate", { paths }),
  onlineCatalogue: (force: boolean) => invoke<OnlineCatalogue>("online_catalogue", { force }),
  onlineFamily: (id: string) => invoke<OnlineFamilyDetail>("online_family", { id }),
  onlineDownload: (id: string) => invoke<OnlineDownloadResult>("online_download", { id }),
  onlinePreview: (id: string) => invoke<string>("online_preview", { id }),
  onlineClearStaging: (id: string) => invoke<void>("online_clear_staging", { id }),
  onlineHosts: () => invoke<string[]>("online_hosts"),
  scanFonts: () => invoke<FontFace[]>("scan_fonts"),
  setFontActive: (path: string, active: boolean) =>
    invoke<void>("set_font_active", { path, active }),
  setFontsActive: (paths: string[], active: boolean) =>
    invoke<void>("set_fonts_active", { paths, active }),
  setFontsActiveSession: (paths: string[]) =>
    invoke<void>("set_fonts_active_session", { paths }),
  installFonts: (paths: string[], existing: string[], mode: InstallMode) =>
    invoke<InstallResult>("install_fonts", { paths, existing, mode }),
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
  adobeAvailable: () => invoke<boolean>("adobe_available"),
  applyFontInApp: (app: AdobeApp, postscriptName: string, label: string) =>
    invoke<string>("apply_font_in_app", { app, postscriptName, label }),
  getPrefs: () => invoke<Record<string, unknown> | null>("get_prefs"),
  setPrefs: (prefs: Record<string, unknown>) => invoke<void>("set_prefs", { prefs }),
};
