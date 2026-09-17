import { AnimatePresence, motion } from "motion/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, ExternalLink, Globe, RefreshCw, Search, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { spring, springSnappy, staggerDelay } from "../design/springs";
import { PillToggle } from "../design/primitives/PillToggle";
import { useFontStore } from "../state/fontStore";
import { useT, type TKey } from "../lib/i18n";
import { usePathFontCss } from "../lib/fontLoader";
import type { OnlineFamily } from "../lib/ipc";

const CATEGORIES = ["sans-serif", "serif", "display", "handwriting", "monospace", "icons"] as const;
const LICENSES = ["OFL-1.1", "Apache-2.0", "UFL-1.0"] as const;

function ago(fetchedAt: number, t: ReturnType<typeof useT>): string {
  const secs = Math.max(0, Math.floor(Date.now() / 1000) - fetchedAt);
  if (secs < 3600) return t("online.updatedMinutes", { count: Math.max(1, Math.floor(secs / 60)) });
  if (secs < 86400) return t("online.updatedHours", { count: Math.floor(secs / 3600) });
  return t("online.updatedDays", { count: Math.floor(secs / 86400) });
}

function catKey(c: string): TKey {
  return (CATEGORIES.includes(c as (typeof CATEGORIES)[number]) ? `online.cat.${c}` : "online.cat.other") as TKey;
}

function licenseShort(spdx: string): string {
  if (spdx === "OFL-1.1") return "OFL";
  if (spdx === "Apache-2.0") return "Apache";
  if (spdx === "UFL-1.0") return "UFL";
  return spdx;
}

export function OnlineView() {
  const t = useT();
  const enabled = useFontStore((s) => s.settings.onlineFontsEnabled);
  const families = useFontStore((s) => s.onlineFamilies);
  const fetchedAt = useFontStore((s) => s.onlineFetchedAt);
  const loading = useFontStore((s) => s.onlineLoading);
  const error = useFontStore((s) => s.onlineError);
  const query = useFontStore((s) => s.onlineQuery);
  const category = useFontStore((s) => s.onlineCategory);
  const license = useFontStore((s) => s.onlineLicense);
  const variableOnly = useFontStore((s) => s.onlineVariableOnly);
  const detail = useFontStore((s) => s.onlineDetail);
  const detailLoading = useFontStore((s) => s.onlineDetailLoading);
  const downloading = useFontStore((s) => s.onlineDownloading);
  const progress = useFontStore((s) => s.onlineProgress);
  const previewPath = useFontStore((s) => s.onlinePreviewPath);
  const sampleText = useFontStore((s) => s.sampleText);
  const previewFamily = usePathFontCss(detail ? detail.id : null, previewPath);
  const installedFamilies = useFontStore((s) => s.fonts);

  const load = useFontStore((s) => s.loadOnlineCatalogue);
  const setQuery = useFontStore((s) => s.setOnlineQuery);
  const setCategory = useFontStore((s) => s.setOnlineCategory);
  const setLicense = useFontStore((s) => s.setOnlineLicense);
  const setVariableOnly = useFontStore((s) => s.setOnlineVariableOnly);
  const openFamily = useFontStore((s) => s.openOnlineFamily);
  const closeFamily = useFontStore((s) => s.closeOnlineFamily);
  const install = useFontStore((s) => s.installOnlineFamily);
  const setSettingsOpen = useFontStore((s) => s.setSettingsOpen);

  const [draft, setDraft] = useState(query);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setQuery(draft.trim()), 300);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [draft, setQuery]);

  useEffect(() => {
    if (enabled && families === null && !loading) void load(false);
  }, [enabled, families, loading, load]);

  const installedNames = useMemo(
    () => new Set(installedFamilies.map((f) => f.family.toLowerCase())),
    [installedFamilies],
  );

  const visible = useMemo(() => {
    if (!families) return [];
    const q = query.toLowerCase();
    return families.filter((f) => {
      if (q && !f.family.toLowerCase().includes(q) && !f.id.includes(q)) return false;
      if (category && f.category !== category) return false;
      if (license && f.license !== license) return false;
      if (variableOnly && !f.variable) return false;
      return true;
    });
  }, [families, query, category, license, variableOnly]);

  if (!enabled) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <span className="empty-tile"><Globe size={26} strokeWidth={1.5} /></span>
        <h2>{t("online.offTitle")}</h2>
        <p>{t("online.offBody")}</p>
        <button className="online-cta" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={14} strokeWidth={1.5} /> {t("online.openSettings")}
        </button>
      </motion.div>
    );
  }

  if (error && !families) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
        <span className="empty-tile"><Globe size={26} strokeWidth={1.5} /></span>
        <h2>{t("online.errorTitle")}</h2>
        <p className="detail-mono">{error}</p>
        <button className="online-cta" onClick={() => void load(true)}>
          <RefreshCw size={14} strokeWidth={1.5} /> {t("online.retry")}
        </button>
      </motion.div>
    );
  }

  if (loading && !families) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
        <span className="empty-tile"><Globe size={26} strokeWidth={1.5} /></span>
        <h2>{t("online.loadingTitle")}</h2>
        <p>{t("online.loadingBody")}</p>
      </motion.div>
    );
  }

  return (
    <div className="online-view">
      <div className="online-bar">
        <div className="online-search">
          <Search size={14} strokeWidth={1.5} className="online-search-icon" />
          <input
            className="online-search-input"
            type="text"
            value={draft}
            placeholder={t("online.searchPlaceholder")}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={t("online.searchPlaceholder")}
          />
          {draft && (
            <button className="search-clear" onClick={() => setDraft("")} aria-label={t("top.searchClear")}>
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="online-chips" role="group" aria-label={t("online.categories")}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`online-chip${category === c ? " online-chip-on" : ""}`}
              onClick={() => setCategory(category === c ? null : c)}
            >
              {t(catKey(c))}
            </button>
          ))}
        </div>
        <div className="online-chips" role="group" aria-label={t("online.licences")}>
          {LICENSES.map((l) => (
            <button
              key={l}
              className={`online-chip${license === l ? " online-chip-on" : ""}`}
              onClick={() => setLicense(license === l ? null : l)}
              title={l}
            >
              {licenseShort(l)}
            </button>
          ))}
        </div>
        <label className="online-variable">
          <PillToggle on={variableOnly} onChange={setVariableOnly} label={t("online.variableOnly")} />
          <span>{t("online.variableOnly")}</span>
        </label>
      </div>

      <div className="online-meta">
        <span className="tabular">{t("online.showing", { shown: visible.length, total: families?.length ?? 0 })}</span>
        {fetchedAt && <span>· {ago(fetchedAt, t)}</span>}
        <button className="online-refresh" onClick={() => void load(true)} disabled={loading} aria-label={t("online.refresh")}>
          <RefreshCw size={13} strokeWidth={1.5} className={loading ? "spin" : undefined} /> {t("online.refresh")}
        </button>
        <span className="online-hosts detail-mono">{t("online.hostsLine")}</span>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <h2>{t("online.noMatchTitle")}</h2>
          <p>{t("online.noMatchBody")}</p>
        </div>
      ) : (
        <div className="online-grid">
          {visible.slice(0, 400).map((f, i) => (
            <OnlineCard
              key={f.id}
              f={f}
              index={i}
              installed={installedNames.has(f.family.toLowerCase())}
              onOpen={() => void openFamily(f.id)}
            />
          ))}
        </div>
      )}
      {visible.length > 400 && (
        <p className="online-more">{t("online.narrowDown", { count: visible.length - 400 })}</p>
      )}

      <AnimatePresence>
        {(detail || detailLoading) && (
          <motion.div
            className="online-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !downloading && closeFamily()}
          >
            <motion.div
              className="online-detail"
              role="dialog"
              aria-modal="true"
              aria-label={detail?.family ?? t("online.loadingTitle")}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={springSnappy}
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading || !detail ? (
                <div className="online-detail-loading">{t("online.loadingDetail")}</div>
              ) : (
                <>
                  <div className="online-detail-head">
                    <div>
                      <h2 className="online-detail-name">{detail.family}</h2>
                      <div className="online-detail-sub">
                        {detail.designer && <span>{t("online.by", { name: detail.designer })}</span>}
                        <span>· {t(catKey(detail.category))}</span>
                        <span>· {t("online.fileCount", { count: detail.files.length })}</span>
                      </div>
                    </div>
                    <button className="search-clear" onClick={closeFamily} disabled={!!downloading} aria-label={t("online.close")}>
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>

                  <div className="online-preview" aria-live="polite">
                    {previewFamily ? (
                      <p className="online-preview-text" style={{ fontFamily: `"${previewFamily}"` }}>
                        {sampleText.trim() || detail.family}
                      </p>
                    ) : (
                      <p className="online-preview-text online-preview-pending">
                        {t("online.previewLoading")}
                      </p>
                    )}
                  </div>

                  <div className="online-licence">
                    <div className="online-licence-row">
                      <span className="online-licence-name">{detail.licenseName}</span>
                      <button className="online-link" onClick={() => void openUrl(detail.licenseUrl)}>
                        {t("online.fullText")} <ExternalLink size={11} strokeWidth={1.5} />
                      </button>
                    </div>
                    {detail.reservedFontName && (
                      <div className="online-licence-rfn">
                        {t("online.reservedFontName", { name: detail.reservedFontName })}
                      </div>
                    )}
                    <div className="online-licence-copy detail-mono">{detail.copyright}</div>
                  </div>

                  <ul className="online-files">
                    {detail.files.map((f) => (
                      <li key={f.filename}>
                        <span>{f.fullName || f.postScriptName}</span>
                        <span className="detail-mono online-file-name">{f.filename}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="online-detail-foot">
                    <span className="online-source detail-mono">
                      {t("online.sourceLine", { dir: detail.sourceDir, id: detail.id.replace(/-/g, "") })}
                    </span>
                    <button
                      className="online-download"
                      onClick={() => void install(detail.id)}
                      disabled={!!downloading}
                    >
                      {downloading === detail.id ? (
                        <>
                          <RefreshCw size={14} strokeWidth={1.5} className="spin" />
                          {progress && progress.total > 0
                            ? t("online.downloadingProgress", { done: progress.done, total: progress.total })
                            : t("online.downloading")}
                        </>
                      ) : (
                        <>
                          <Download size={14} strokeWidth={1.5} /> {t("online.addToLibrary")}
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OnlineCard({
  f,
  index,
  installed,
  onOpen,
}: {
  f: OnlineFamily;
  index: number;
  installed: boolean;
  onOpen: () => void;
}) {
  const t = useT();
  return (
    <motion.article
      className="family-card online-card"
      tabIndex={0}
      role="button"
      aria-label={f.family}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: staggerDelay(Math.min(index, 24)) }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="card-head">
        <span className="card-name">{f.family}</span>
        <span className="card-spacer" />
        {f.variable && <span className="badge badge-variable">VAR</span>}
        {installed && <span className="badge online-badge-have">{t("online.inLibrary")}</span>}
      </div>
      <div className="online-card-meta">
        <span>{t(catKey(f.category))}</span>
        <span>· {t("online.styleCount", { count: f.weights.length * f.styles.length })}</span>
        <span>· {licenseShort(f.license)}</span>
      </div>
    </motion.article>
  );
}
