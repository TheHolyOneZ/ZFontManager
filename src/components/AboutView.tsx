import { invoke } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import { ArrowUpRight, Download, Globe } from "lucide-react";
import { spring, springSoft, staggerDelay } from "../design/springs";
import { toast } from "../design/primitives/Toast";


function GithubGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12 0 1.53-.01 2.76-.01 3.14 0 .3.2.66.8.55A10.52 10.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}


function openUrl(url: string) {
  invoke("open_url", { url }).catch((e) => toast.error("Couldn't open link", String(e)));
}

const LINKS = [
  {
    label: "TheHolyOneZ on GitHub",
    sub: "github.com/TheHolyOneZ",
    url: "https://github.com/TheHolyOneZ",
    icon: <GithubGlyph />,
  },
  {
    label: "More projects",
    sub: "zsync.eu",
    url: "https://zsync.eu",
    icon: <Globe size={16} strokeWidth={1.5} />,
  },
  {
    label: "Landing & download page",
    sub: "zsync.eu/zfontmanager",
    url: "https://zsync.eu/zfontmanager/",
    icon: <Download size={16} strokeWidth={1.5} />,
  },
  {
    label: "ZFontManager source",
    sub: "github.com/TheHolyOneZ/ZFontManager",
    url: "https://github.com/TheHolyOneZ/ZFontManager",
    icon: <GithubGlyph />,
  },
];

const STACK = ["Tauri v2", "Rust", "React 19", "TypeScript", "Vite", "pnpm"];

export function AboutView() {
  return (
    <motion.div
      className="about-view"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
    >
      <img className="about-icon" src="/icon-512.png" alt="" draggable={false} />
      <h1 className="about-name">ZFontManager</h1>
      <div className="about-version tabular">Version 0.1.0 · GPL-3.0</div>
      <p className="about-desc">
        The font manager Linux never got and Windows/macOS have to pay for. Preview, tag,
        activate and deactivate, and install fonts across all three OSes from one clean
        native app — your fonts never leave your machine.
      </p>

      <div className="about-stack" aria-label="Tech stack">
        {STACK.map((t) => (
          <span key={t} className="about-chip tabular">
            {t}
          </span>
        ))}
      </div>

      <div className="about-links">
        {LINKS.map((l, i) => (
          <motion.button
            key={l.url}
            className="about-link"
            onClick={() => openUrl(l.url)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: staggerDelay(i) }}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="about-link-icon">{l.icon}</span>
            <span className="about-link-text">
              <span className="about-link-label">{l.label}</span>
              <span className="about-link-sub detail-mono">{l.sub}</span>
            </span>
            <ArrowUpRight size={14} strokeWidth={1.5} className="about-link-arrow" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
