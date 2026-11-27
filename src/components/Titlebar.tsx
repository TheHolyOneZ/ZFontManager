import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";
import { useFontStore } from "../state/fontStore";
import { motion } from "motion/react";
import { springSoft } from "../design/springs";
import { useT } from "../lib/i18n";

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

const IS_MAC =
  typeof navigator !== "undefined" &&
  (/Mac|iPod|iPhone|iPad/i.test(navigator.platform) || /Macintosh/i.test(navigator.userAgent));

function MacTrafficLights({
  onClose,
  onMinimize,
  onMaximize,
  closeLabel,
  minLabel,
  maxLabel,
}: {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  closeLabel: string;
  minLabel: string;
  maxLabel: string;
}) {
  return (
    <div className="mac-traffic-lights">
      <button className="mac-dot mac-dot-close" aria-label={closeLabel} onClick={onClose}>
        <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <line x1="1.8" y1="1.8" x2="6.2" y2="6.2" />
          <line x1="6.2" y1="1.8" x2="1.8" y2="6.2" />
        </svg>
      </button>
      <button className="mac-dot mac-dot-min" aria-label={minLabel} onClick={onMinimize}>
        <svg width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
          <line x1="1.5" y1="4" x2="6.5" y2="4" />
        </svg>
      </button>
      <button className="mac-dot mac-dot-max" aria-label={maxLabel} onClick={onMaximize}>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true">
          <polygon points="1.5,1.5 5,1.5 1.5,5" />
          <polygon points="6.5,6.5 3,6.5 6.5,3" />
        </svg>
      </button>
    </div>
  );
}

export function Titlebar() {
  const t = useT();
  const win = getCurrentWindow();
  const setSettingsOpen = useFontStore((s) => s.setSettingsOpen);
  const brand = (
    <div className="titlebar-brand" data-tauri-drag-region>
      <img className="brand-mark" src="/icon.png" alt="" draggable={false} />
      <span className="titlebar-title" data-tauri-drag-region>
        FontManager
      </span>
    </div>
  );

  return (
    <motion.div
      className="titlebar"
      data-tauri-drag-region
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={springSoft}
    >
      {IS_MAC ? (
        <div className="titlebar-mac-left" data-tauri-drag-region>
          <MacTrafficLights
            onClose={() => void win.close()}
            onMinimize={() => void win.minimize()}
            onMaximize={() => void win.toggleMaximize()}
            closeLabel={t("titlebar.close")}
            minLabel={t("titlebar.minimize")}
            maxLabel={t("titlebar.maximize")}
          />
          {brand}
        </div>
      ) : (
        brand
      )}
      <div className="titlebar-controls">
        <button
          data-tour="settings"
          aria-label={t("titlebar.settings")}
          onClick={() => setSettingsOpen(true)}
        >
          <SettingsGlyph />
        </button>
        {!IS_MAC && (
          <>
            <span className="titlebar-sep" />
            <button aria-label={t("titlebar.minimize")} onClick={() => void win.minimize()}>
              <Minus size={13} strokeWidth={1.5} />
            </button>
            <button aria-label={t("titlebar.maximize")} onClick={() => void win.toggleMaximize()}>
              <Square size={10} strokeWidth={1.5} />
            </button>
            <button className="tc-close" aria-label={t("titlebar.close")} onClick={() => void win.close()}>
              <X size={13} strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
