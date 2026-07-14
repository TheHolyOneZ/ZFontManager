import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useFontStore } from "../state/fontStore";
import { motion } from "motion/react";
import { springSoft } from "../design/springs";


function SettingsGlyph({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="2.75" y1="4.75" x2="7.5" y2="4.75" />
      <line x1="12.9" y1="4.75" x2="13.25" y2="4.75" />
      <circle cx="10.2" cy="4.75" r="2" />
      <line x1="2.75" y1="11.25" x2="3.1" y2="11.25" />
      <line x1="8.5" y1="11.25" x2="13.25" y2="11.25" />
      <circle cx="5.8" cy="11.25" r="2" />
    </svg>
  );
}


export function Titlebar() {
  const win = getCurrentWindow();
  const setSettingsOpen = useFontStore((s) => s.setSettingsOpen);
  return (
    <motion.div
      className="titlebar"
      data-tauri-drag-region
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springSoft}
    >
      <div className="titlebar-brand" data-tauri-drag-region>
        <img className="brand-mark" src="/icon.png" alt="" draggable={false} />
        <span className="titlebar-title" data-tauri-drag-region>
          FontManager
        </span>
      </div>
      <div className="titlebar-controls">
        <button aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <SettingsGlyph />
        </button>
        <span className="titlebar-sep" />
        <button aria-label="Minimize" onClick={() => void win.minimize()}>
          <Minus size={13} strokeWidth={1.5} />
        </button>
        <button aria-label="Maximize" onClick={() => void win.toggleMaximize()}>
          <Square size={10} strokeWidth={1.5} />
        </button>
        <button className="tc-close" aria-label="Close" onClick={() => void win.close()}>
          <X size={13} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  );
}
