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
  const sideRef = useRef<InstallMode>("link");
  const setSideBoth = (mode: InstallMode) => {
    sideRef.current = mode;
    setSide(mode);
  };

  useEffect(() => {
    void ipc.defaultLibraryDir().then(setDefaultDir).catch(() => {});
  }, []);

  useEffect(() => {
    const unlistenDrop = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setDragging(true);
      } else if (event.payload.type === "drop") {
        const mode = sideRef.current;
        setDragging(false);
        setSideBoth("link");
        void installPaths(event.payload.paths, mode).finally(() => {
          setTimeout(() => setProgress(null), 900);
        });
      } else {
        setDragging(false);
        setSideBoth("link");
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
                className={`dropchoice-panel ${side === "link" ? "dropchoice-active" : ""}`}
                onDragOver={() => setSideBoth("link")}
              >
                <Link2 size={30} strokeWidth={1.75} />
                <div className="dropchoice-title">{t("drop.linkTitle")}</div>
                <div className="dropchoice-sub">{t("drop.linkSub")}</div>
              </div>
              <div
                className={`dropchoice-panel dropchoice-move ${side === "move" ? "dropchoice-active" : ""}`}
                onDragOver={() => setSideBoth("move")}
              >
                <FolderInput size={30} strokeWidth={1.75} />
                <div className="dropchoice-title">{t("drop.moveTitle")}</div>
                <div className="dropchoice-sub detail-mono" title={target}>
                  {t("drop.moveSub", { dir: target })}
                </div>
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
