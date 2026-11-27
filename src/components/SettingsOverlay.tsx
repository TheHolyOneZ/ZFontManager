import { open, save } from "@tauri-apps/plugin-dialog";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  Cable,
  Database,
  FolderDown,
  FolderOpen,
  FolderPlus,
  Info,
  Library,
  LoaderCircle,
  MessageSquarePlus,
  Palette,
  PanelLeft,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { PillToggle } from "../design/primitives/PillToggle";
import { spring, springSoft } from "../design/springs";
import { ipc } from "../lib/ipc";
import { toast } from "../design/primitives/Toast";
import { useFontStore, type SettingsPage } from "../state/fontStore";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useT, type TKey } from "../lib/i18n";
import { LanguageSelect } from "./LanguageSelect";
import { APP_LICENSE, APP_VERSION } from "../lib/version";
import { Group, Row, Segmented, SettingsQuery } from "./settings/kit";
import { AppearancePage } from "./settings/AppearancePage";
import { SidebarPage } from "./settings/SidebarPage";

const IS_LINUX = navigator.platform.toUpperCase().includes("LINUX");

const TRANSLATE_GUIDE_URL =
  "https://github.com/TheHolyOneZ/ZFontManager/blob/main/docs/TRANSLATING.md";

const REQUEST_LANGUAGE_URL =
  "https://github.com/TheHolyOneZ/ZFontManager/issues/new?title=Language%20request%3A%20";

const PAGES: { id: SettingsPage; icon: ReactNode; label: TKey }[] = [
  { id: "general", icon: <Settings2 size={15} strokeWidth={1.5} />, label: "settingsNav.general" },
  { id: "library", icon: <Library size={15} strokeWidth={1.5} />, label: "settingsNav.library" },
  { id: "appearance", icon: <Palette size={15} strokeWidth={1.5} />, label: "settingsNav.appearance" },
  { id: "sidebar", icon: <PanelLeft size={15} strokeWidth={1.5} />, label: "settingsNav.sidebar" },
  { id: "connections", icon: <Cable size={15} strokeWidth={1.5} />, label: "settingsNav.connections" },
  { id: "data", icon: <Database size={15} strokeWidth={1.5} />, label: "settingsNav.data" },
  { id: "about", icon: <Info size={15} strokeWidth={1.5} />, label: "settingsNav.about" },
];

function GeneralPage() {
  const t = useT();
  const openState = useFontStore((s) => s.settingsOpen);
  const closeToTray = useFontStore((s) => s.closeToTray);
  const setCloseToTray = useFontStore((s) => s.setCloseToTray);
  const startMinimized = useFontStore((s) => s.startMinimized);
  const setStartMinimized = useFontStore((s) => s.setStartMinimized);
  const soundPref = useFontStore((s) => s.soundPref);
  const setSoundPref = useFontStore((s) => s.setSoundPref);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    if (!openState) return;
    void ipc.getAutostart().then(setAutostart).catch(() => {});
  }, [openState]);

  return (
    <>
      <Group title={t("settings.language")}>
        <Row label={t("settings.language")} sub={t("settings.languageSub")} keywords="locale translation">
          <LanguageSelect />
        </Row>
        <Row
          label={t("settings.translateTitle")}
          sub={t("settings.translateSub")}
          keywords="translate contribute"
          stack
        >
          <div className="set-actions set-actions-inline">
            <button className="set-btn" onClick={() => void openUrl(TRANSLATE_GUIDE_URL).catch(() => {})}>
              <BookOpen size={13} strokeWidth={1.5} />
              {t("settings.translateGuide")}
              <ArrowUpRight size={12} strokeWidth={1.5} className="set-btn-arrow" />
            </button>
            <button className="set-btn" onClick={() => void openUrl(REQUEST_LANGUAGE_URL).catch(() => {})}>
              <MessageSquarePlus size={13} strokeWidth={1.5} />
              {t("settings.requestLanguage")}
              <ArrowUpRight size={12} strokeWidth={1.5} className="set-btn-arrow" />
            </button>
          </div>
        </Row>
      </Group>

      <Group title={t("settings.system")}>
        <Row label={t("settings.closeToTray")} sub={t("settings.closeToTraySub")}>
          <PillToggle on={closeToTray} onChange={(on) => setCloseToTray(on)} label={t("settings.closeToTray")} />
        </Row>
        <Row label={t("settings.autostart")} sub={t("settings.autostartSub")} keywords="login boot">
          <PillToggle
            on={autostart}
            onChange={(on) => {
              setAutostart(on);
              void ipc.setAutostart(on).catch((e) => {
                setAutostart(!on);
                toast.error(t("toast.autostartFailed"), String(e));
              });
            }}
            label={t("settings.autostart")}
          />
        </Row>
        <Row label={t("settings.startMinimized")} sub={t("settings.startMinimizedSub")} keywords="tray">
          <PillToggle on={startMinimized} onChange={(on) => setStartMinimized(on)} label={t("settings.startMinimized")} />
        </Row>
      </Group>

      <Group title={t("settings.sound")}>
        <Row label={t("settings.interfaceSounds")} sub={t("settings.interfaceSoundsSub")} keywords="audio volume">
          <Segmented
            value={soundPref}
            label={t("settings.soundLevelAria")}
            onChange={(lvl) => setSoundPref(lvl)}
            options={(["off", "subtle", "on"] as const).map((lvl) => ({ value: lvl, label: t(`sound.${lvl}`) }))}
          />
        </Row>
      </Group>
    </>
  );
}

function LibraryPage() {
  const t = useT();
  const openState = useFontStore((s) => s.settingsOpen);
  const settings = useFontStore((s) => s.settings);
  const updateSettings = useFontStore((s) => s.updateSettings);
  const scanning = useFontStore((s) => s.phase === "scanning");
  const scanProgress = useFontStore((s) => s.scanProgress);
  const [defaultLibDir, setDefaultLibDir] = useState("");

  useEffect(() => {
    if (!openState || defaultLibDir) return;
    void ipc.defaultLibraryDir().then(setDefaultLibDir).catch(() => {});
  }, [openState, defaultLibDir]);

  const addFolder = async () => {
    const dir = await open({ directory: true, title: t("settings.addFolderTitle") });
    if (!dir || settings.extraDirs.includes(dir)) return;
    void updateSettings({ ...settings, extraDirs: [...settings.extraDirs, dir] });
  };

  const pickLibraryDir = async () => {
    const dir = await open({ directory: true, title: t("settings.libraryFolderTitle") });
    if (!dir) return;
    void updateSettings({ ...settings, libraryDir: dir, libraryDirEnabled: true });
  };

  const customDirActive = settings.libraryDirEnabled && settings.libraryDir != null;

  return (
    <>
      <Group title={t("settings.library")}>
        <Row label={t("settings.watch")} sub={t("settings.watchSub")} keywords="rescan automatic">
          <PillToggle
            on={settings.watchEnabled}
            onChange={(on) => void updateSettings({ ...settings, watchEnabled: on })}
            label={t("settings.watch")}
          />
        </Row>
        <Row label={t("settings.autoActivate")} sub={t("settings.autoActivateSub")} keywords="import install">
          <PillToggle
            on={settings.autoActivateImports}
            onChange={(on) => void updateSettings({ ...settings, autoActivateImports: on })}
            label={t("settings.autoActivate")}
          />
        </Row>
      </Group>

      <Group title={t("settings.watchedFolders")}>
        <Row label={t("settings.watchedFolders")} sub={t("settings.watchedFoldersSub")} keywords="folder directory scan" stack>
          <div className="set-folders">
            {settings.extraDirs.map((dir) => (
              <div key={dir} className="set-folder">
                <FolderOpen size={13} strokeWidth={1.5} />
                <span className="detail-mono set-folder-path" title={dir}>{dir}</span>
                <button
                  className="set-icon-btn"
                  aria-label={t("settings.removeFolder", { dir })}
                  onClick={() =>
                    void updateSettings({ ...settings, extraDirs: settings.extraDirs.filter((d) => d !== dir) })
                  }
                >
                  <X size={12} strokeWidth={1.6} />
                </button>
              </div>
            ))}
            <div className="set-actions set-actions-inline">
              <button className="set-btn" onClick={() => void addFolder()} disabled={scanning}>
                <FolderPlus size={13} strokeWidth={1.5} />
                {t("settings.addFolder")}
              </button>
              {scanning && (
                <span className="set-scanning tabular" role="status" aria-live="polite">
                  <LoaderCircle size={13} strokeWidth={1.5} className="settings-scanning-icon" />
                  {scanProgress.total > 0
                    ? t("scan.reading", { done: scanProgress.done, total: scanProgress.total })
                    : t("settings.scanningFolders")}
                </span>
              )}
            </div>
          </div>
        </Row>
      </Group>

      <Group title={t("settings.libraryFolder")}>
        <Row label={t("settings.libraryFolder")} sub={t("settings.libraryFolderSub")} keywords="install location" stack>
          <div className="set-folders">
            <div className={`set-folder ${customDirActive ? "is-dim" : ""}`}>
              <span className="set-folder-tag">{t("settings.libraryDefault")}</span>
              <button
                className="path-link detail-mono set-folder-path"
                title={defaultLibDir}
                onClick={() => void revealItemInDir(defaultLibDir).catch(() => {})}
              >
                {defaultLibDir}
              </button>
            </div>
            <div className={`set-folder ${customDirActive ? "" : "is-dim"}`}>
              <PillToggle
                on={settings.libraryDirEnabled}
                onChange={(on) => {
                  if (on !== settings.libraryDirEnabled) void updateSettings({ ...settings, libraryDirEnabled: on });
                }}
                label={t("settings.libraryCustom")}
              />
              <span className="set-folder-tag">{t("settings.libraryCustom")}</span>
              {settings.libraryDir ? (
                <button
                  className="path-link detail-mono set-folder-path"
                  title={settings.libraryDir}
                  onClick={() => void revealItemInDir(settings.libraryDir ?? "").catch(() => {})}
                >
                  {settings.libraryDir}
                </button>
              ) : (
                <span className="set-folder-path" />
              )}
              <button className="set-btn" onClick={() => void pickLibraryDir()}>
                <FolderPlus size={13} strokeWidth={1.5} />
                {t("settings.libraryAddFolder")}
              </button>
            </div>
          </div>
        </Row>
      </Group>
    </>
  );
}

function ConnectionsPage() {
  const t = useT();
  const openState = useFontStore((s) => s.settingsOpen);
  const settings = useFontStore((s) => s.settings);
  const updateSettings = useFontStore((s) => s.updateSettings);
  const affinityConnection = useFontStore((s) => s.affinityConnection);
  const refreshAffinityConnection = useFontStore((s) => s.refreshAffinityConnection);
  const pollAffinityLink = useFontStore((s) => s.pollAffinityLink);

  useEffect(() => {
    if (openState && !IS_LINUX && settings.affinityEnabled) void refreshAffinityConnection();
  }, [openState, settings.affinityEnabled, refreshAffinityConnection]);

  useEffect(() => {
    if (!openState || IS_LINUX || !settings.affinityEnabled) return;
    const id = window.setInterval(() => void pollAffinityLink(), 2000);
    return () => window.clearInterval(id);
  }, [openState, settings.affinityEnabled, pollAffinityLink]);

  const affinityDetail = !settings.affinityEnabled
    ? t("settings.affinityDisabled")
    : !affinityConnection
      ? t("settings.affinityChecking")
      : affinityConnection.reachable
        ? `${t("settings.affinityOnline")}${affinityConnection.version ? ` · ${affinityConnection.version}` : ""} · ${t("settings.affinityDocs", { count: affinityConnection.docCount })}`
        : affinityConnection.error
          ? `${t("settings.affinityOffline")} · ${affinityConnection.error}`
          : t("settings.affinityOffline");
  const affinityDot = !settings.affinityEnabled
    ? "affinity-dot-off"
    : !affinityConnection
      ? ""
      : affinityConnection.reachable
        ? "affinity-dot-on"
        : "affinity-dot-off";

  return (
    <>
      <Group title={t("settings.online")}>
        <Row label={t("settings.onlineEnable")} sub={t("settings.onlineEnableSub")} keywords="google fonts download nerd">
          <PillToggle
            on={settings.onlineFontsEnabled}
            onChange={(on) => {
              void updateSettings({ ...settings, onlineFontsEnabled: on });
              if (!on) useFontStore.setState({ onlineFamilies: null, onlineDetail: null });
            }}
            label={t("settings.onlineEnable")}
          />
        </Row>
        <Row label={t("settings.onlineHostsLabel")} sub={t("settings.onlineHelp")} keywords="network privacy" stack>
          <p className="set-mono">{t("settings.onlineHosts")}</p>
        </Row>
      </Group>

      {!IS_LINUX && (
        <Group title={t("settings.affinity")}>
          <Row label={t("settings.affinityConnection")} sub={affinityDetail} keywords="affinity designer">
            <span className={`affinity-dot ${affinityDot}`} aria-hidden />
          </Row>
          <Row label={t("settings.affinityEnable")} sub={t("settings.affinityEnableSub")}>
            <PillToggle
              on={settings.affinityEnabled}
              onChange={(on) => {
                void updateSettings({ ...settings, affinityEnabled: on }).then(() => refreshAffinityConnection());
              }}
              label={t("settings.affinityEnable")}
            />
          </Row>
          <Row label={t("settings.affinityDeactivate")} sub={t("settings.affinityDeactivateSub")}>
            <PillToggle
              on={settings.affinityDeactivateOnQuit}
              onChange={(on) => void updateSettings({ ...settings, affinityDeactivateOnQuit: on })}
              label={t("settings.affinityDeactivate")}
            />
          </Row>
          <p className="set-note">{t("settings.affinityHelp")}</p>
        </Group>
      )}
    </>
  );
}

function DataPage() {
  const t = useT();
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
    <Group title={t("settings.libraryData")}>
      <Row label={t("settings.curation")} sub={t("settings.curationSub")} keywords="backup export import json">
        <div className="set-actions set-actions-inline">
          <button className="set-btn" onClick={() => void exportData()}>
            <FolderDown size={13} strokeWidth={1.5} />
            {t("settings.export")}
          </button>
          <button className="set-btn" onClick={() => void importData()}>
            <FolderOpen size={13} strokeWidth={1.5} />
            {t("settings.import")}
          </button>
        </div>
      </Row>
    </Group>
  );
}

function AboutPage() {
  const t = useT();
  const setSettingsOpen = useFontStore((s) => s.setSettingsOpen);
  return (
    <Group>
      <Row
        label={
          <span className="set-about">
            <img src="/favicon.png" alt="" draggable={false} />
            <span>ZFontManager {APP_VERSION}</span>
          </span>
        }
        sub={`${APP_LICENSE} · ${t("settings.footerNote")}`}
        keywords="version license about"
      >
        <button
          className="set-btn"
          onClick={() => {
            setSettingsOpen(false);
            useFontStore.getState().setNav({ kind: "about" });
          }}
        >
          {t("settingsNav.openAbout")}
        </button>
      </Row>
      <Row label={t("settingsNav.tourLabel")} sub={t("settingsNav.tourSub")} keywords="tour onboarding help">
        <button
          className="set-btn"
          onClick={() => {
            setSettingsOpen(false);
            useFontStore.getState().startTour();
          }}
        >
          {t("settingsNav.startTour")}
        </button>
      </Row>
    </Group>
  );
}

const RENDER: Record<SettingsPage, () => ReactNode> = {
  general: () => <GeneralPage />,
  library: () => <LibraryPage />,
  appearance: () => <AppearancePage />,
  sidebar: () => <SidebarPage />,
  connections: () => <ConnectionsPage />,
  data: () => <DataPage />,
  about: () => <AboutPage />,
};

export function SettingsOverlay() {
  const t = useT();
  const openState = useFontStore((s) => s.settingsOpen);
  const setSettingsOpen = useFontStore((s) => s.setSettingsOpen);
  const page = useFontStore((s) => s.settingsPage);
  const trapRef = useFocusTrap<HTMLDivElement>(openState);
  const [query, setQuery] = useState("");
  const [empty, setEmpty] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!openState) return;
    setQuery("");
    const focusId = window.setTimeout(() => searchRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
      if ((e.key === "f" || e.key === "F") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusId);
      window.removeEventListener("keydown", onKey);
    };
  }, [openState, setSettingsOpen]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const blocks = el.querySelectorAll<HTMLElement>(".set-page-title, .set-group");
    if (blocks.length === 0) return;
    const tween = gsap.fromTo(
      blocks,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.36, ease: "power3.out", stagger: 0.035, clearProps: "transform,opacity,visibility" },
    );
    return () => {
      tween.kill();
      gsap.set(blocks, { clearProps: "transform,opacity,visibility" });
    };
  }, [page, openState, query === ""]);

  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let any = false;
    el.querySelectorAll<HTMLElement>(".set-group").forEach((g) => {
      const has = g.querySelector(".set-row, .token-row, .set-note, .side-lists, .preset-grid") !== null;
      g.hidden = !has;
      if (has) any = true;
    });
    el.querySelectorAll<HTMLElement>(".set-page").forEach((p) => {
      p.hidden = p.querySelector(".set-group:not([hidden])") === null;
    });
    setEmpty(!any);
  });

  const searching = query.trim().length > 0;
  const shown = searching ? PAGES : PAGES.filter((p) => p.id === page);

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
            initial={{ y: 24, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 14, scale: 0.99, opacity: 0 }}
            transition={springSoft}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label={t("settings.title")}
          >
            <header className="settings-head">
              <h2 className="settings-title">{t("settings.title")}</h2>
              <button className="detail-close" aria-label={t("settings.close")} onClick={() => setSettingsOpen(false)}>
                <X size={15} strokeWidth={1.5} />
              </button>
            </header>
            <div className="settings-body">
              <nav className="settings-rail" aria-label={t("settings.title")}>
                <label className="settings-search">
                  <Search size={13} strokeWidth={1.6} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("settingsNav.search")}
                    aria-label={t("settingsNav.searchAria")}
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === "Escape" && query) {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        setQuery("");
                      }
                    }}
                  />
                  {searching && (
                    <button className="search-clear" onClick={() => setQuery("")} aria-label={t("top.searchClear")}>
                      <X size={12} strokeWidth={2} />
                    </button>
                  )}
                </label>
                <div className="settings-rail-list">
                  {PAGES.map((p) => {
                    const on = !searching && p.id === page;
                    return (
                      <button
                        key={p.id}
                        className={`settings-nav ${on ? "is-on" : ""} ${p.id === "about" ? "is-last" : ""}`}
                        aria-current={on ? "page" : undefined}
                        onClick={() => {
                          setQuery("");
                          useFontStore.setState({ settingsPage: p.id });
                        }}
                      >
                        {on && <motion.span className="settings-nav-pill" layoutId="settings-nav-pill" transition={spring} />}
                        <span className="settings-nav-icon">{p.icon}</span>
                        <span className="settings-nav-label">{t(p.label)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="settings-rail-foot tabular">
                  {APP_VERSION}
                </div>
              </nav>
              <div ref={contentRef} className="settings-content">
                <SettingsQuery.Provider value={query}>
                  {shown.map((p) => (
                    <div key={p.id} className="set-page">
                      <h3 className="set-page-title">{t(p.label)}</h3>
                      {RENDER[p.id]()}
                    </div>
                  ))}
                </SettingsQuery.Provider>
                {searching && empty && (
                  <div className="set-empty">{t("settingsNav.noResults", { query: query.trim() })}</div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
