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
  SunMoon,
  Volume2,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect } from "react";
import { PillToggle } from "../design/primitives/PillToggle";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useT } from "../lib/i18n";
import { LanguageSelect } from "./LanguageSelect";
import { APP_LICENSE, APP_VERSION } from "../lib/version";

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
  const soundPref = useFontStore((s) => s.soundPref);
  const setSoundPref = useFontStore((s) => s.setSoundPref);
  const themePref = useFontStore((s) => s.themePref);
  const setThemePref = useFontStore((s) => s.setThemePref);
  const trapRef = useFocusTrap<HTMLDivElement>(openState);

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
                  <button className="settings-add-folder" onClick={() => void addFolder()}>
                    <FolderPlus size={13} strokeWidth={1.5} />
                    {t("settings.addFolder")}
                  </button>
                </div>
              </div>
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
