import { open, save } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "motion/react";
import {
  DatabaseBackup,
  Eye,
  FolderDown,
  FolderOpen,
  FolderPlus,
  SunMoon,
  Volume2,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { PillToggle } from "../design/primitives/PillToggle";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";

export function SettingsOverlay() {
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
    const dir = await open({ directory: true, title: "Add a folder to scan" });
    if (!dir || settings.extraDirs.includes(dir)) return;
    void updateSettings({ ...settings, extraDirs: [...settings.extraDirs, dir] });
  };

  const exportData = async () => {
    const dest = await save({
      title: "Export library data",
      defaultPath: "zfontmanager-library.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (dest) await useFontStore.getState().exportLibraryData(dest);
  };

  const importData = async () => {
    const src = await open({
      title: "Import library data",
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
            aria-label="Settings"
          >
            <div className="settings-scroll">
            <header className="compare-head">
              <h2 className="compare-title">Settings</h2>
              <button
                className="detail-close"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>

            <section className="settings-section">
              <div className="detail-heading">Library</div>

              <div className="settings-row">
                <div>
                  <div className="settings-label">Watch for new fonts</div>
                  <div className="settings-sub">
                    Rescan automatically when fonts appear in scanned folders
                  </div>
                </div>
                <PillToggle
                  on={settings.watchEnabled}
                  onChange={(on) =>
                    void updateSettings({ ...settings, watchEnabled: on })
                  }
                  label="Watch for new fonts"
                />
              </div>

              <div className="settings-row settings-col">
                <div>
                  <div className="settings-label">Watched folders</div>
                  <div className="settings-sub">
                    Scanned in addition to your system font directories
                  </div>
                </div>
                <div className="settings-folders">
                  {settings.extraDirs.map((dir) => (
                    <div key={dir} className="settings-folder">
                      <FolderOpen size={13} strokeWidth={1.5} />
                      <span className="detail-mono settings-folder-path">{dir}</span>
                      <button
                        aria-label={`Remove ${dir}`}
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
                    Add folder…
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">Library data</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <DatabaseBackup size={13} strokeWidth={1.5} /> Tags, collections & notes
                  </div>
                  <div className="settings-sub">
                    Back up your curation to a file, or merge one in from another machine
                  </div>
                </div>
                <div className="settings-data-actions">
                  <button className="settings-data-btn" onClick={() => void exportData()}>
                    <FolderDown size={13} strokeWidth={1.5} />
                    Export…
                  </button>
                  <button className="settings-data-btn" onClick={() => void importData()}>
                    <FolderOpen size={13} strokeWidth={1.5} />
                    Import…
                  </button>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">Appearance</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <SunMoon size={13} strokeWidth={1.5} /> Theme
                  </div>
                  <div className="settings-sub">
                    Same glass, different light — System follows your desktop
                  </div>
                </div>
                <div className="view-toggle sound-toggle" role="radiogroup" aria-label="Theme">
                  {(["dark", "light", "system"] as const).map((t) => (
                    <button
                      key={t}
                      role="radio"
                      aria-checked={themePref === t}
                      className={`view-btn sound-btn ${themePref === t ? "view-btn-active" : ""}`}
                      onClick={() => setThemePref(t)}
                    >
                      {t === "dark" ? "Dark" : t === "light" ? "Light" : "System"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <Eye size={13} strokeWidth={1.5} /> Reduce motion
                  </div>
                  <div className="settings-sub">
                    Replace springs with quick fades, regardless of system setting
                  </div>
                </div>
                <PillToggle
                  on={motionPref === "reduced"}
                  onChange={(on) => setMotionPref(on ? "reduced" : "system")}
                  label="Reduce motion"
                />
              </div>
            </section>

            <section className="settings-section">
              <div className="detail-heading">Sound</div>
              <div className="settings-row">
                <div>
                  <div className="settings-label">
                    <Volume2 size={13} strokeWidth={1.5} /> Interface sounds
                  </div>
                  <div className="settings-sub">
                    Soft synthesized feedback for toggles and notifications
                  </div>
                </div>
                <div className="view-toggle sound-toggle" role="radiogroup" aria-label="Sound level">
                  {(["off", "subtle", "on"] as const).map((lvl) => (
                    <button
                      key={lvl}
                      role="radio"
                      aria-checked={soundPref === lvl}
                      className={`view-btn sound-btn ${soundPref === lvl ? "view-btn-active" : ""}`}
                      onClick={() => setSoundPref(lvl)}
                    >
                      {lvl === "off" ? "Off" : lvl === "subtle" ? "Subtle" : "On"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <footer className="settings-footer tabular">
              <img className="settings-footer-icon" src="/favicon.png" alt="" draggable={false} />
              ZFontManager 0.1.0 · GPL-3.0 · fonts stay on your machine ·{" "}
              <button
                className="settings-replay"
                onClick={() => {
                  setSettingsOpen(false);
                  useFontStore.getState().startTour();
                }}
              >
                replay tour
              </button>
            </footer>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
