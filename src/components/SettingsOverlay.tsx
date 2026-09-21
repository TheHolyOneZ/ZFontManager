import { open, save } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  DatabaseBackup,
  Eye,
  FolderDown,
  FolderOpen,
  FolderPlus,
  Languages,
  MessageSquarePlus,
  Scaling,
  SunMoon,
  Volume2,
  X,
} from "lucide-react";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { PillToggle } from "../design/primitives/PillToggle";
import { springSoft } from "../design/springs";
import { ipc } from "../lib/ipc";
import { useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useT } from "../lib/i18n";
import { LanguageSelect } from "./LanguageSelect";
import { APP_LICENSE, APP_VERSION } from "../lib/version";

const IS_LINUX = navigator.platform.toUpperCase().includes("LINUX");

const TRANSLATE_GUIDE_URL =
  "https://github.com/TheHolyOneZ/ZFontManager/blob/main/docs/TRANSLATING.md";

const REQUEST_LANGUAGE_URL =
  "https://github.com/TheHolyOneZ/ZFontManager/issues/new?title=Language%20request%3A%20";

export function SettingsOverlay() {
  const t = useT();
  const openState = useFontStore((s) => s.settingsOpen);
  const setSettingsOpen = useFontStore((s) => s.setSettingsOpen);
  const settings = useFontStore((s) => s.settings);
  const updateSettings = useFontStore((s) => s.updateSettings);
  const motionPref = useFontStore((s) => s.motionPref);
  const setMotionPref = useFontStore((s) => s.setMotionPref);
  const transparencyPref = useFontStore((s) => s.transparencyPref);
  const setTransparencyPref = useFontStore((s) => s.setTransparencyPref);
  const uiScale = useFontStore((s) => s.uiScale);
  const appliedScale = useFontStore((s) => s.appliedScale);
  const setUiScale = useFontStore((s) => s.setUiScale);
  const soundPref = useFontStore((s) => s.soundPref);
  const setSoundPref = useFontStore((s) => s.setSoundPref);
  const themePref = useFontStore((s) => s.themePref);
  const setThemePref = useFontStore((s) => s.setThemePref);
  const scanning = useFontStore((s) => s.phase === "scanning");
  const scanProgress = useFontStore((s) => s.scanProgress);
  const trapRef = useFocusTrap<HTMLDivElement>(openState);
  const [defaultLibDir, setDefaultLibDir] = useState("");
  const affinityConnection = useFontStore((s) => s.affinityConnection);
  const refreshAffinityConnection = useFontStore((s) => s.refreshAffinityConnection);

  useEffect(() => {
    if (openState && !IS_LINUX && settings.affinityEnabled) void refreshAffinityConnection();
  }, [openState, settings.affinityEnabled, refreshAffinityConnection]);

  useEffect(() => {
    if (!openState || defaultLibDir) return;
    void ipc.defaultLibraryDir().then(setDefaultLibDir).catch(() => {});
  }, [openState, defaultLibDir]);

  useEffect(() => {
    if (!openState) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSettingsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openState, setSettingsOpen]);

  const addFolder = async () => {
    const dir = await open({ directory: true, title: t("settings.addFolderTitle") });
    if (!dir || settings.extraDirs.includes(dir)) return;
    void updateSettings({ ...settings, extraDirs: [...settings.extraDirs, dir] });
  };

  const pickLibraryDir = async () => {
    const dir = await open({ directory: true, title: t("settings.libraryFolderTitle") });
    if (!dir) return;
    // Picking a folder turns the custom folder on.
    void updateSettings({ ...settings, libraryDir: dir, libraryDirEnabled: true });
  };

  const setCustomDirEnabled = (on: boolean) => {
    if (on === settings.libraryDirEnabled) return;
    // The path is kept while disabled, so re-enabling restores it as-is.
    void updateSettings({ ...settings, libraryDirEnabled: on });
  };

  // The custom folder is in effect only when enabled with a folder picked.
  const customDirActive = settings.libraryDirEnabled && settings.libraryDir != null;

  const affinityDetail = !settings.affinityEnabled
    ? t("settings.affinityDisabled")
    : !affinityConnection
    ? t("settings.affinityChecking")
    : affinityConnection.reachable
      ? `${t("settings.affinityOnline")}${affinityConnection.version ? ` · ${affinityConnection.version}` : ""} · ${t("settings.affinityDocs", { count: affinityConnection.docCount })}`
      : (affinityConnection.error
          ? `${t("settings.affinityOffline")} · ${affinityConnection.error}`
          : t("settings.affinityOffline"));
  const affinityDot = !settings.affinityEnabled
    ? "affinity-dot-off"
    : !affinityConnection
    ? ""
    : affinityConnection.reachable
      ? "affinity-dot-on"
      : "affinity-dot-off";

  const exportData = async () => {
    const dest = await save({
      title: t("settings.exportDataTitle"),
      defaultPath: "zfontmanager-library.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (dest) await useFontStore.getState().exportLibraryData(dest);
  };

  const importData = async () => {
    const src = await open({
      title: t("settings.importDataTitle"),
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (typeof src === "string") await useFontStore.getState().importLibraryData(src);
  };

  return (
    <AnimatePresence>
      {openState && (
        <motion.div
          className="compare-backdrop settings-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            ref={trapRef}
            className="settings-panel"
            initial={{ y: 32, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.98, opacity: 0 }}
            transition={springSoft}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t("settings.title")}
          >
            <div className="settings-scroll">
            <header className="compare-head">
              <h2 className="compare-title">{t("settings.title")}</h2>
              <button
                className="detail-close"
                aria-label={t("settings.close")}
                onClick={() => setSettingsOpen(false)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <section className="settings-section">
              <div className="detail-heading">{t("settings.language")}</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <Languages size={13} strokeWidth={1.5} /> {t("settings.language")}
                  </div>
                  <div className="settings-sub">{t("settings.languageSub")}</div>
                </div>
                <LanguageSelect />
              </div>
              <div className="settings-translate">
                <div className="settings-translate-text">
                  <div className="settings-translate-title">{t("settings.translateTitle")}</div>
                  <div className="settings-sub">{t("settings.translateSub")}</div>
                </div>
                <div className="settings-data-actions">
                  <button
                    className="settings-data-btn"
                    onClick={() => void openUrl(TRANSLATE_GUIDE_URL).catch(() => {})}
                  >
                    <BookOpen size={13} strokeWidth={1.5} />
                    {t("settings.translateGuide")}
                    <ArrowUpRight size={12} strokeWidth={1.5} className="settings-btn-arrow" />
                  </button>
                  <button
                    className="settings-data-btn"
                    onClick={() => void openUrl(REQUEST_LANGUAGE_URL).catch(() => {})}
                  >
                    <MessageSquarePlus size={13} strokeWidth={1.5} />
                    {t("settings.requestLanguage")}
                    <ArrowUpRight size={12} strokeWidth={1.5} className="settings-btn-arrow" />
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">{t("settings.library")}</div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">{t("settings.watch")}</div>
                  <div className="settings-sub">{t("settings.watchSub")}</div>
                </div>
                <PillToggle
                  on={settings.watchEnabled}
                  onChange={(on) =>
                    void updateSettings({ ...settings, watchEnabled: on })
                  }
                  label={t("settings.watch")}
                />
              </div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">{t("settings.autoActivate")}</div>
                  <div className="settings-sub">{t("settings.autoActivateSub")}</div>
                </div>
                <PillToggle
                  on={settings.autoActivateImports}
                  onChange={(on) =>
                    void updateSettings({ ...settings, autoActivateImports: on })
                  }
                  label={t("settings.autoActivate")}
                />
              </div>

              <div className="settings-row settings-col">
                <div>
                  <div className="settings-label">{t("settings.watchedFolders")}</div>
                  <div className="settings-sub">{t("settings.watchedFoldersSub")}</div>
                </div>
                <div className="settings-folders">
                  {settings.extraDirs.map((dir) => (
                    <div key={dir} className="settings-folder">
                      <FolderOpen size={13} strokeWidth={1.5} />
                      <span className="detail-mono settings-folder-path">{dir}</span>
                      <button
                        aria-label={t("settings.removeFolder", { dir })}
                        onClick={() =>
                          void updateSettings({
                            ...settings,
                            extraDirs: settings.extraDirs.filter((d) => d !== dir),
                          })
                        }
                      >
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="settings-add-folder"
                    onClick={() => void addFolder()}
                    disabled={scanning}
                  >
                    <FolderPlus size={13} strokeWidth={1.5} />
                    {t("settings.addFolder")}
                  </button>
                  {scanning && (
                    <div className="settings-scanning tabular" role="status" aria-live="polite">
                      <LoaderCircle size={13} strokeWidth={1.5} className="settings-scanning-icon" />
                      {scanProgress.total > 0
                        ? t("scan.reading", { done: scanProgress.done, total: scanProgress.total })
                        : t("settings.scanningFolders")}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">{t("settings.libraryFolder")}</div>
              <div className="settings-row settings-col">
                <div>
                  <div className="settings-label">{t("settings.libraryFolder")}</div>
                  <div className="settings-sub">{t("settings.libraryFolderSub")}</div>
                </div>
                <div className="settings-folders">
                  <div className={`settings-folder ${customDirActive ? "settings-dim" : ""}`}>
                    <span className="settings-folder-tag">{t("settings.libraryDefault")}</span>
                    <button
                      className="path-link detail-mono settings-folder-path"
                      title={defaultLibDir}
                      onClick={() => void revealItemInDir(defaultLibDir).catch(() => {})}
                    >
                      <FolderOpen size={13} strokeWidth={1.5} />
                      <span className="settings-folder-path">{defaultLibDir}</span>
                    </button>
                  </div>
                  <div className={`settings-row ${customDirActive ? "" : "settings-dim"}`}>
                    <div className="settings-label">
                      <PillToggle
                        on={settings.libraryDirEnabled}
                        onChange={(on) => setCustomDirEnabled(on)}
                        label={t("settings.libraryCustom")}
                      />
                      <span className="settings-folder-path">{t("settings.libraryCustom")}</span>
                    </div>
                    <button className="settings-add-folder" onClick={() => void pickLibraryDir()}>
                      <FolderPlus size={13} strokeWidth={1.5} />
                      {t("settings.libraryAddFolder")}
                    </button>
                  </div>
                  {settings.libraryDir && (
                    <div className={`settings-folder ${customDirActive ? "" : "settings-dim"}`}>
                      <button
                        className="path-link detail-mono settings-folder-path"
                        title={settings.libraryDir}
                        onClick={() =>
                          void revealItemInDir(settings.libraryDir ?? "").catch(() => {})
                        }
                      >
                        <FolderOpen size={13} strokeWidth={1.5} />
                        <span className="settings-folder-path">{settings.libraryDir}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {!IS_LINUX && (
              <section className="settings-section">
                <div className="detail-heading">{t("settings.affinity")}</div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t("settings.affinityConnection")}</div>
                    <div className="settings-sub">{affinityDetail}</div>
                  </div>
                  <span className={`affinity-dot ${affinityDot}`} aria-hidden />
                </div>
                <div className="settings-row" data-relation="enable-below">
                  <div>
                    <div className="settings-label">{t("settings.affinityEnable")}</div>
                    <div className="settings-sub">{t("settings.affinityEnableSub")}</div>
                  </div>
                  <PillToggle
                    on={settings.affinityEnabled}
                    onChange={(on) => {
                      void updateSettings({ ...settings, affinityEnabled: on }).then(() =>
                        refreshAffinityConnection(),
                      );
                    }}
                    label={t("settings.affinityEnable")}
                  />
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-label">{t("settings.affinityDeactivate")}</div>
                    <div className="settings-sub">{t("settings.affinityDeactivateSub")}</div>
                  </div>
                  <PillToggle
                    on={settings.affinityDeactivateOnQuit}
                    onChange={(on) =>
                      void updateSettings({ ...settings, affinityDeactivateOnQuit: on })
                    }
                    label={t("settings.affinityDeactivate")}
                  />
                </div>
                <div className="settings-sub">{t("settings.affinityHelp")}</div>
              </section>
            )}

            <section className="settings-section">
              <div className="detail-heading">{t("settings.online")}</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">{t("settings.onlineEnable")}</div>
                  <div className="settings-sub">{t("settings.onlineEnableSub")}</div>
                </div>
                <PillToggle
                  on={settings.onlineFontsEnabled}
                  onChange={(on) => {
                    void updateSettings({ ...settings, onlineFontsEnabled: on });
                    if (!on) useFontStore.setState({ onlineFamilies: null, onlineDetail: null });
                  }}
                  label={t("settings.onlineEnable")}
                />
              </div>
              <div className="settings-sub settings-hosts detail-mono">{t("settings.onlineHosts")}</div>
              <div className="settings-sub">{t("settings.onlineHelp")}</div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">{t("settings.libraryData")}</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <DatabaseBackup size={13} strokeWidth={1.5} /> {t("settings.curation")}
                  </div>
                  <div className="settings-sub">{t("settings.curationSub")}</div>
                </div>
                <div className="settings-data-actions">
                  <button className="settings-data-btn" onClick={() => void exportData()}>
                    <FolderDown size={13} strokeWidth={1.5} />
                    {t("settings.export")}
                  </button>
                  <button className="settings-data-btn" onClick={() => void importData()}>
                    <FolderOpen size={13} strokeWidth={1.5} />
                    {t("settings.import")}
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">{t("settings.appearance")}</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <SunMoon size={13} strokeWidth={1.5} /> {t("settings.theme")}
                  </div>
                  <div className="settings-sub">{t("settings.themeSub")}</div>
                </div>
                <div
                  className="view-toggle sound-toggle"
                  role="radiogroup"
                  aria-label={t("settings.theme")}
                >
                  {(["dark", "light", "system"] as const).map((mode) => (
                    <button
                      key={mode}
                      role="radio"
                      aria-checked={themePref === mode}
                      className={`view-btn sound-btn ${themePref === mode ? "view-btn-active" : ""}`}
                      onClick={() => setThemePref(mode)}
                    >
                      {t(`theme.${mode}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <Eye size={13} strokeWidth={1.5} /> {t("settings.reduceMotion")}
                  </div>
                  <div className="settings-sub">{t("settings.reduceMotionSub")}</div>
                </div>
                <PillToggle
                  on={motionPref === "reduced"}
                  onChange={(on) => setMotionPref(on ? "reduced" : "system")}
                  label={t("settings.reduceMotion")}
                />
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <Eye size={13} strokeWidth={1.5} /> {t("settings.reduceTransparency")}
                  </div>
                  <div className="settings-sub">{t("settings.reduceTransparencySub")}</div>
                </div>
                <PillToggle
                  on={transparencyPref === "reduced"}
                  onChange={(on) => setTransparencyPref(on ? "reduced" : "full")}
                  label={t("settings.reduceTransparency")}
                />
              </div>
              <div className="settings-row settings-col">
                <div>
                  <div className="settings-label">
                    <Scaling size={13} strokeWidth={1.5} /> {t("settings.uiScale")}
                  </div>
                  <div className="settings-sub">
                    {uiScale === "auto"
                      ? t("settings.uiScaleAutoSub", { percent: Math.round(appliedScale * 100) })
                      : t("settings.uiScaleSub")}
                  </div>
                </div>
                <div
                  className="view-toggle sound-toggle scale-toggle"
                  role="radiogroup"
                  aria-label={t("settings.uiScale")}
                >
                  {(["auto", 0.8, 0.9, 1, 1.1, 1.25] as const).map((step) => (
                    <button
                      key={String(step)}
                      role="radio"
                      aria-checked={uiScale === step}
                      className={`view-btn sound-btn ${uiScale === step ? "view-btn-active" : ""}`}
                      onClick={() => setUiScale(step)}
                    >
                      {step === "auto" ? t("settings.uiScaleAuto") : `${Math.round(step * 100)}%`}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">{t("settings.sound")}</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <Volume2 size={13} strokeWidth={1.5} /> {t("settings.interfaceSounds")}
                  </div>
                  <div className="settings-sub">{t("settings.interfaceSoundsSub")}</div>
                </div>
                <div
                  className="view-toggle sound-toggle"
                  role="radiogroup"
                  aria-label={t("settings.soundLevelAria")}
                >
                  {(["off", "subtle", "on"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      role="radio"
                      aria-checked={soundPref === lvl}
                      className={`view-btn sound-btn ${soundPref === lvl ? "view-btn-active" : ""}`}
                      onClick={() => setSoundPref(lvl)}
                    >
                      {t(`sound.${lvl}`)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <footer className="settings-footer tabular">
              <img className="settings-footer-icon" src="/favicon.png" alt="" draggable={false} />
              ZFontManager {APP_VERSION} · {APP_LICENSE} · {t("settings.footerNote")} ·{" "}
              <button
                className="settings-replay"
                onClick={() => {
                  setSettingsOpen(false);
                  useFontStore.getState().startTour();
                }}
              >
                {t("settings.replayTour")}
              </button>
            </footer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
