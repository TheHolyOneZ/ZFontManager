import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "motion/react";
import { FolderInput, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { springSnappy } from "../design/springs";
import { ipc, type InstallMode, type InstallProgress } from "../lib/ipc";
import { useFontStore } from "../state/fontStore";
import { useT } from "../lib/i18n";

export function DropZone() {
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const [side, setSide] = useState<InstallMode>("link");
  const [defaultDir, setDefaultDir] = useState("");
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const installPaths = useFontStore((s) => s.installPaths);
  const libraryDir = useFontStore((s) => s.settings.libraryDir);
  const moveRef = useRef<HTMLDivElement>(null);

  // DOM drag events don't fire reliably during a native file drag, so the
  // active panel is picked from the cursor position Tauri reports instead.
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

  useEffect(() => {
    void ipc.defaultLibraryDir().then(setDefaultDir).catch(() => {});
  }, []);

  useEffect(() => {
    const unlistenDrop = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over" || event.payload.type === "enter") {
        setDragging(true);
        setSide(sideAt(event.payload.position));
      } else if (event.payload.type === "drop") {
        const mode = sideAt(event.payload.position);
        setDragging(false);
        setSide("link");
        void installPaths(event.payload.paths, mode).finally(() => {
          setTimeout(() => setProgress(null), 900);
        });
      } else {
        setDragging(false);
        setSide("link");
      }
    });
    const unlistenProgress = listen<InstallProgress>("install:progress", (e) => {
      setProgress(e.payload);
    });
    return () => {
      void unlistenDrop.then((fn) => fn());
      void unlistenProgress.then((fn) => fn());
    };
  }, [installPaths]);

  const target = libraryDir ?? defaultDir;
  const moveTitle = libraryDir
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
                className={`dropchoice-panel ${side === "link" ? "dropchoice-active" : "dropchoice-dim"}`}
              >
                <Link2 size={30} strokeWidth={1.75} />
                <div className="dropchoice-title">{t("drop.linkTitle")}</div>
                <div className="dropchoice-sub">{t("drop.linkSub")}</div>
              </div>
              <div
                ref={moveRef}
                className={`dropchoice-panel dropchoice-move ${side === "move" ? "dropchoice-active" : "dropchoice-dim"}`}
                title={target}
              >
                <FolderInput size={30} strokeWidth={1.75} />
                <div className="dropchoice-title">{moveTitle}</div>
                <div className="dropchoice-sub dropchoice-warn">{t("drop.moveSub")}</div>
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
