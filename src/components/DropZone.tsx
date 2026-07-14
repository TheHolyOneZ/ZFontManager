import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "motion/react";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { springSoft, springSnappy } from "../design/springs";
import type { InstallProgress } from "../lib/ipc";
import { useFontStore } from "../state/fontStore";


export function DropZone() {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const installPaths = useFontStore((s) => s.installPaths);

  useEffect(() => {
    const unlistenDrop = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setDragging(true);
      } else if (event.payload.type === "drop") {
        setDragging(false);
        void installPaths(event.payload.paths).finally(() => {
          setTimeout(() => setProgress(null), 900);
        });
      } else {
        setDragging(false);
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

  return (
    <>
      <AnimatePresence>
        {dragging && (
          <motion.div
            className="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="dropzone-card"
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={springSoft}
            >
              <motion.span
                className="dropzone-icon"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Download size={28} strokeWidth={2} />
              </motion.span>
              <div className="dropzone-title">Drop to install</div>
              <div className="dropzone-sub">Font files, folders, or .zip archives</div>
            </motion.div>
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
                Installing {progress.total} font{progress.total === 1 ? "" : "s"}…
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
