import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "motion/react";
import { FolderInput, FolderOpen, FolderPlus, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { springSnappy } from "../design/springs";
import { ipc, type InstallMode, type InstallProgress } from "../lib/ipc";
import { useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";

export function DropZone() {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const [side, setSide] = useState<InstallMode>("link");
  const [into, setInto] = useState<string | null | undefined>(undefined);
  const [defaultDir, setDefaultDir] = useState("");
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const installPaths = useFontStore((s) => s.installPaths);
  const installInto = useFontStore((s) => s.installInto);
  const collections = useFontStore((s) => s.collections);
  const collectionNames = Object.keys(collections).sort((a, b) => a.localeCompare(b));
  const chipsRef = useRef<HTMLDivElement>(null);
  const libraryDir = useFontStore((s) => s.settings.libraryDir);
  const libraryDirEnabled = useFontStore((s) => s.settings.libraryDirEnabled);
  const moveRef = useRef<HTMLDivElement>(null);

  const sideAt = (pos: { x: number; y: number }): InstallMode => {
    const dpr = window.devicePixelRatio || 1;
    const r = moveRef.current?.getBoundingClientRect();
    if (
      r &&
      pos.x / dpr >= r.left &&
      pos.x / dpr <= r.right &&
      pos.y / dpr >= r.top &&
      pos.y / dpr <= r.bottom
    ) {
      return "move";
    }
    return "link";
  };

  const collectionAt = (pos: { x: number; y: number }): string | null | undefined => {
    const dpr = window.devicePixelRatio || 1;
    const x = pos.x / dpr;
    const y = pos.y / dpr;
    for (const el of chipsRef.current?.querySelectorAll<HTMLElement>("[data-collection]") ?? []) {
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        return el.dataset.collection || null;
      }
    }
    return undefined;
  };

  useEffect(() => {
    void ipc.defaultLibraryDir().then(setDefaultDir).catch(() => {});
  }, []);

  useEffect(() => {
    const unlistenDrop = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over" || event.payload.type === "enter") {
        setDragging(true);
        setSide(sideAt(event.payload.position));
        setInto(collectionAt(event.payload.position));
      } else if (event.payload.type === "drop") {
        const mode = sideAt(event.payload.position);
        const target = collectionAt(event.payload.position);
        setDragging(false);
        setSide("link");
        setInto(undefined);
        const done = () => setTimeout(() => setProgress(null), 900);
        if (target === undefined) {
          void installPaths(event.payload.paths, mode).finally(done);
        } else {
          void installInto(event.payload.paths, target).finally(done);
        }
      } else {
        setDragging(false);
        setSide("link");
        setInto(undefined);
      }
    });
    const unlistenProgress = listen<InstallProgress>("install:progress", (e) => {
      setProgress(e.payload);
      if (e.payload.done >= e.payload.total) {
        setTimeout(() => setProgress(null), 900);
      }
    });
    return () => {
      void unlistenDrop.then((fn) => fn());
      void unlistenProgress.then((fn) => fn());
    };
  }, [installPaths, installInto]);

  const target = libraryDirEnabled && libraryDir ? libraryDir : defaultDir;
  const moveTitle = libraryDirEnabled && libraryDir
    ? t("drop.moveTitle", { path: libraryDir })
    : t("drop.moveTitleDefault");

  return (
    <>
      <AnimatePresence>
        {dragging && (
          <motion.div
            className="dropchoice"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="dropchoice-hint">{t("drop.sub")}</div>
            <div className="dropchoice-panels">
              <div
                className={`dropchoice-panel ${into === undefined && side === "link" ? "dropchoice-active" : "dropchoice-dim"}`}
              >
                <Link2 size={30} strokeWidth={1.75} />
                <div className="dropchoice-title">{t("drop.linkTitle")}</div>
                <div className="dropchoice-sub">{t("drop.linkSub")}</div>
              </div>
              <div
                ref={moveRef}
                className={`dropchoice-panel dropchoice-move ${into === undefined && side === "move" ? "dropchoice-active" : "dropchoice-dim"}`}
                title={target}
              >
                <FolderInput size={30} strokeWidth={1.75} />
                <div className="dropchoice-title">{moveTitle}</div>
                <div className="dropchoice-sub dropchoice-warn">{t("drop.moveSub")}</div>
              </div>
            </div>
            <div className={`dropchoice-collections ${into !== undefined ? "dropchoice-collections-on" : ""}`}>
              <div className="dropchoice-collections-title">{t("drop.toCollection")}</div>
              <div className="dropchoice-chips" ref={chipsRef}>
                <div
                  data-collection=""
                  className={`dropchoice-chip dropchoice-chip-new ${into === null ? "dropchoice-chip-active" : ""}`}
                >
                  <FolderPlus size={14} strokeWidth={1.75} />
                  <span>{t("drop.newCollection")}</span>
                </div>
                {collectionNames.map((name) => (
                  <div
                    key={name}
                    data-collection={name}
                    className={`dropchoice-chip ${into === name ? "dropchoice-chip-active" : ""}`}
                    title={name}
                  >
                    <FolderOpen size={14} strokeWidth={1.75} />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {progress && (
          <motion.div
            className="install-toast glass-e3"
            initial={{ opacity: 0, y: -24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={springSnappy}
          >
            <div className="install-head">
              <span className="install-title">
                {t("drop.installing", { count: progress.total })}
              </span>
              <span className="install-count tabular">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="install-file">{progress.file}</div>
            <div className="install-track">
              <motion.div
                className="install-fill"
                animate={{ width: `${(progress.done / progress.total) * 100}%` }}
                transition={springSnappy}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
