import { AnimatePresence, motion } from "motion/react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, ExternalLink, Globe, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { spring, springSnappy, staggerDelay } from "../design/springs";
import { SIZES, useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";
import { usePathFontCss } from "../lib/fontLoader";
import type { NerdFamily, NerdVariant } from "../lib/ipc";
import { ago } from "../lib/ago";

const REPO = "https://github.com/ryanoasis/nerd-fonts";
const VARIANTS: NerdVariant[] = ["standard", "mono", "propo"];

function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function mb(bytes: number): string {
  return (bytes / 1048576).toFixed(1);
}

export function NerdBrowser() {
  const t = useT();
  const families = useFontStore((s) => s.nerdFamilies);
  const fetchedAt = useFontStore((s) => s.nerdFetchedAt);
  const release = useFontStore((s) => s.nerdRelease);
  const loading = useFontStore((s) => s.nerdLoading);
  const error = useFontStore((s) => s.nerdError);
  const detail = useFontStore((s) => s.nerdDetail);
  const previewPath = useFontStore((s) => s.nerdPreviewPath);
  const downloading = useFontStore((s) => s.onlineDownloading);
  const progress = useFontStore((s) => s.onlineProgress);
  const sampleText = useFontStore((s) => s.sampleText);
  const sizeIndex = useFontStore((s) => s.sizeIndex);
  const installed = useFontStore((s) => s.fonts);
  const load = useFontStore((s) => s.loadNerdCatalogue);
  const openFamily = useFontStore((s) => s.openNerdFamily);
  const closeFamily = useFontStore((s) => s.closeNerdFamily);
  const install = useFontStore((s) => s.installNerdFamily);
  const previewFamily = usePathFontCss(detail ? `nerd-${detail.id}` : null, previewPath);

  const [query, setQuery] = useState("");
  const [variants, setVariants] = useState<NerdVariant[]>(["standard", "mono"]);

  useEffect(() => {
    if (families === null && !loading && !error) void load(false);
  }, [families, loading, error, load]);

  const installedNames = useMemo(() => installed.map((f) => compact(f.family)), [installed]);

  const visible = useMemo(() => {
    if (!families) return [];
    const q = compact(query);
    if (!q) return families;
    return families.filter(
      (f) => compact(f.family).includes(q) || compact(f.original).includes(q) || compact(f.id).includes(q),
    );
  }, [families, query]);

  const isInstalled = (f: NerdFamily) => {
    const prefix = compact(f.patchedName);
    return installedNames.some((n) => n.startsWith(prefix) && n.includes("nerdfont"));
  };

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

  if (!families) {
    return (
      <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={spring}>
        <span className="empty-tile"><Globe size={26} strokeWidth={1.5} /></span>
        <h2>{t("online.loadingTitle")}</h2>
        <p>{t("nerd.loadingBody")}</p>
      </motion.div>
    );
  }

  const busy = detail !== null && downloading === `nerd:${detail.id}`;
  const toggleVariant = (v: NerdVariant) =>
    setVariants((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : VARIANTS.filter((x) => x === v || cur.includes(x))));

  return (
    <div className="online-view">
      <div className="online-bar">
        <div className="online-search">
          <Search size={14} strokeWidth={1.5} className="online-search-icon" />
          <input
            className="online-search-input"
            type="text"
            value={query}
            placeholder={t("nerd.searchPlaceholder")}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t("nerd.searchPlaceholder")}
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery("")} aria-label={t("top.searchClear")}>
              <X size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="online-meta">
        <span className="tabular">{t("online.showing", { shown: visible.length, total: families.length })}</span>
        {release && <span>· {t("nerd.release", { release })}</span>}
        {fetchedAt && <span>· {ago(fetchedAt, t)}</span>}
        <button className="online-refresh" onClick={() => void load(true)} disabled={loading} aria-label={t("online.refresh")}>
          <RefreshCw size={13} strokeWidth={1.5} className={loading ? "spin" : undefined} /> {t("online.refresh")}
        </button>
        <span className="online-hosts detail-mono">{t("nerd.hostsLine")}</span>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <h2>{t("online.noMatchTitle")}</h2>
          <p>{t("online.noMatchBody")}</p>
        </div>
      ) : (
        <div className="online-grid">
          {visible.map((f, i) => (
            <motion.article
              key={f.id}
              className="family-card online-card"
              tabIndex={0}
              role="button"
              aria-label={f.family}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: staggerDelay(Math.min(i, 24)) }}
              onClick={() => void openFamily(f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void openFamily(f.id);
                }
              }}
            >
              <div className="card-head">
                <span className="card-name">{f.family}</span>
                <span className="card-spacer" />
                {isInstalled(f) && <span className="badge online-badge-have">{t("online.inLibrary")}</span>}
              </div>
              <div className="online-card-meta">
                <span>{f.original}</span>
                <span>· {f.licenseShort}</span>
              </div>
              {f.description && <p className="nerd-desc">{f.description}</p>}
            </motion.article>
          ))}
        </div>
      )}

      <AnimatePresence>
        {detail && (
          <motion.div
            className="online-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !busy && closeFamily()}
          >
            <motion.div
              className="online-detail"
              role="dialog"
              aria-modal="true"
              aria-label={detail.family}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={springSnappy}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="online-detail-head">
                <div>
                  <h2 className="online-detail-name">{detail.family}</h2>
                  <div className="online-detail-sub">
                    <span>{t("nerd.patchedFrom", { name: detail.original, version: detail.version })}</span>
                  </div>
                </div>
                <button className="search-clear" onClick={closeFamily} disabled={busy} aria-label={t("online.close")}>
                  <X size={14} strokeWidth={2} />
                </button>
              </div>

              <div className="online-preview" aria-live="polite">
                {previewFamily ? (
                  <p className="online-preview-text" style={{ fontFamily: `"${previewFamily}"`, fontSize: SIZES[sizeIndex] }}>
                    {sampleText.trim() || detail.original}
                  </p>
                ) : (
                  <p className="online-preview-text online-preview-pending">{t("online.previewLoading")}</p>
                )}
              </div>
              <p className="nerd-note">{t("nerd.previewNote", { name: detail.original })}</p>

              <div className="nerd-variants" role="group" aria-label={t("nerd.variants")}>
                {VARIANTS.map((v) => (
                  <label key={v} className="nerd-variant">
                    <input
                      type="checkbox"
                      checked={variants.includes(v)}
                      onChange={() => toggleVariant(v)}
                      disabled={busy}
                    />
                    <span>{t(`nerd.variant.${v}`, { name: detail.patchedName })}</span>
                    <span className="nerd-variant-sub">{t(`nerd.variant.${v}Sub`)}</span>
                  </label>
                ))}
              </div>

              <div className="online-licence">
                <div className="online-licence-row">
                  <span className="online-licence-name">{detail.licenseName}</span>
                  <button
                    className="online-link"
                    onClick={() => void openUrl(`${REPO}/tree/${release ?? "master"}/patched-fonts/${detail.id}`)}
                  >
                    {t("nerd.licenceFiles")} <ExternalLink size={11} strokeWidth={1.5} />
                  </button>
                </div>
                {detail.reservedName && detail.original !== detail.patchedName && (
                  <div className="online-licence-rfn">
                    {t("nerd.rfn", { original: detail.original, patched: detail.patchedName })}
                  </div>
                )}
                {detail.description && <div className="online-licence-copy">{detail.description}</div>}
              </div>

              <div className="online-detail-foot">
                <span className="online-source detail-mono">
                  {t("nerd.sourceLine", { release: release ?? "", file: `${detail.id}.tar.xz` })}
                </span>
                <button
                  className="online-download"
                  onClick={() => void install(detail.id, variants)}
                  disabled={!!downloading || variants.length === 0}
                  title={variants.length === 0 ? t("nerd.pickVariant") : undefined}
                >
                  {busy ? (
                    <>
                      <RefreshCw size={14} strokeWidth={1.5} className="spin" />
                      {progress && progress.bytes && progress.total > 0 && progress.done >= progress.total
                        ? t("nerd.unpacking")
                        : progress && progress.bytes && progress.total > 0
                          ? t("nerd.downloadingMb", { done: mb(progress.done), total: mb(progress.total) })
                          : t("online.downloading")}
                    </>
                  ) : (
                    <>
                      <Download size={14} strokeWidth={1.5} /> {t("online.addToLibrary")}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
