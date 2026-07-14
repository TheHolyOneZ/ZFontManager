import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { spring, springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";

interface TourStep {

  target?: string;
  title: string;
  body: string;

  onEnter?: () => void;
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to ZFontManager",
    body: "Every font on this machine, in one place — preview, organize, activate, and install. This tour takes about a minute.",
  },
  {
    target: ".topbar-sample",
    title: "Your words, every font",
    body: "Type anything here and the whole library re-renders in it. Try your brand name or that headline you're setting.",
  },
  {
    target: ".topbar-size",
    title: "Preview size",
    body: "Drag from caption-small to poster-huge. The scale is stepped so useful sizes are easy to hit.",
  },
  {
    target: ".topbar-search",
    title: "Find anything",
    body: "Search by name, tag, format, foundry — even your own notes. Press / from anywhere to jump here.",
  },
  {
    target: ".view-toggle",
    title: "Three ways to look",
    body: "Grid for browsing, list for managing, waterfall to study one typeface across every size.",
    onEnter: () => useFontStore.setState({ viewMode: "grid" }),
  },
  {
    target: ".family-card",
    title: "A font family",
    body: "The pill switch activates or deactivates it system-wide — deactivated fonts vanish from other apps' pickers but stay in your library. Star favorites, right-click for everything else.",
    onEnter: () => useFontStore.setState({ viewMode: "grid" }),
  },
  {
    target: ".detail",
    title: "The inspector",
    body: "Click any font to open this panel: switch styles, drag variable axes, browse every glyph, export files, read the license. Drag its edge to resize.",
    onEnter: () => {
      const st = useFontStore.getState();
      if (!st.selectedFamily && st.visibleOrder.length > 0) {
        st.select(st.visibleOrder[0]);
      }
    },
  },
  {
    target: ".sidebar-heading-row",
    title: "Collections",
    body: "Group fonts per project or client — \"Client X\", \"Personal brand\". Create one here, then right-click any font to add it.",
    onEnter: () => useFontStore.getState().select(null),
  },
  {
    target: ".sidebar-footer",
    title: "Nothing is ever lost",
    body: "Uninstalled fonts land in the trash, not the void. Restore them any time.",
  },
  {
    target: '[aria-label="Settings"]',
    title: "Settings",
    body: "Watch folders for new fonts, add extra scan locations, tune motion and sounds.",
  },
  {
    title: "One last thing",
    body: "Drag font files, folders, or zip archives anywhere onto this window to install them. That's it — enjoy your library.",
  },
];

function useTargetRect(selector: string | undefined, step: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let tries = 0;
    let raf = 0;
    const find = () => {
      const el = document.querySelector(selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else if (tries++ < 40) {

        raf = requestAnimationFrame(find);
      } else {
        setRect(null);
      }
    };
    find();
    const onResize = () => {
      const el = document.querySelector(selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [selector, step]);

  return rect;
}

const PAD = 8;
const CARD_W = 340;
const MARGIN = 12;


function cardPosition(rect: DOMRect | null, cardH: number): React.CSSProperties {
  if (!rect) {
    return { left: "50%", top: "50%", translate: "-50% -50%" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vw - CARD_W - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh - cardH - MARGIN);

  const centeredX = clampX(rect.left + rect.width / 2 - CARD_W / 2);
  const fitsBelow = rect.bottom + PAD + MARGIN + cardH <= vh;
  const fitsAbove = rect.top - PAD - MARGIN - cardH >= 0;

  if (fitsBelow) return { left: centeredX, top: rect.bottom + PAD + MARGIN };
  if (fitsAbove) return { left: centeredX, top: rect.top - PAD - MARGIN - cardH };


  const sideY = clampY(rect.top + rect.height / 2 - cardH / 2);
  if (rect.left - PAD - MARGIN - CARD_W >= 0) {
    return { left: rect.left - PAD - MARGIN - CARD_W, top: sideY };
  }
  if (rect.right + PAD + MARGIN + CARD_W <= vw) {
    return { left: rect.right + PAD + MARGIN, top: sideY };
  }

  return { left: centeredX, top: clampY(rect.bottom + PAD + MARGIN) };
}

export function Onboarding() {
  const phase = useFontStore((s) => s.phase);
  const onboarded = useFontStore((s) => s.onboarded);
  const tourStep = useFontStore((s) => s.tourStep);
  const startTour = useFontStore((s) => s.startTour);
  const setTourStep = useFontStore((s) => s.setTourStep);
  const endTour = useFontStore((s) => s.endTour);
  const fontsReady = useFontStore((s) => s.fonts.length > 0);

  const step = tourStep !== null ? STEPS[tourStep] : null;
  const rect = useTargetRect(step?.target, tourStep ?? -1);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);


  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [tourStep, rect]);


  useEffect(() => {
    if (tourStep !== null) STEPS[tourStep]?.onEnter?.();
  }, [tourStep]);


  useEffect(() => {
    if (tourStep === null) return;
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Escape") endTour();
      if ((e.key === "ArrowRight" || e.key === "Enter") && tourStep < STEPS.length - 1) {
        setTourStep(tourStep + 1);
      } else if ((e.key === "ArrowRight" || e.key === "Enter") && tourStep === STEPS.length - 1) {
        endTour();
      }
      if (e.key === "ArrowLeft" && tourStep > 0) setTourStep(tourStep - 1);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [tourStep, setTourStep, endTour]);

  const showWelcomePrompt = phase === "ready" && fontsReady && !onboarded && tourStep === null;
  const last = tourStep === STEPS.length - 1;

  return (
    <>

      <AnimatePresence>
        {showWelcomePrompt && (
          <motion.div
            className="tour-invite glass-e3"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={springSoft}
            role="dialog"
            aria-label="Welcome"
          >
            <img className="tour-invite-icon" src="/icon.png" alt="" draggable={false} />
            <div className="tour-invite-text">
              <div className="tour-invite-title">New here?</div>
              <div className="tour-invite-sub">A one-minute tour of your new font library.</div>
            </div>
            <motion.button
              className="tour-start"
              onClick={startTour}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              Take the tour
            </motion.button>
            <button className="detail-close" aria-label="Skip tour" onClick={endTour}>
              <X size={14} strokeWidth={1.5} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>


      <AnimatePresence>
        {step && (
          <motion.div
            className="tour-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >

            <motion.div
              className="tour-spotlight"
              animate={
                rect
                  ? {
                      x: rect.left - PAD,
                      y: rect.top - PAD,
                      width: rect.width + PAD * 2,
                      height: rect.height + PAD * 2,
                      opacity: 1,
                    }
                  : {
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2,
                      width: 0,
                      height: 0,
                      opacity: 1,
                    }
              }
              transition={spring}
            />
            <motion.div
              key={tourStep}
              ref={cardRef}
              className="tour-card glass-e3"
              style={cardPosition(rect, cardH)}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={springSoft}
              role="dialog"
              aria-label={step.title}
            >
              <div className="tour-card-title">{step.title}</div>
              <div className="tour-card-body">{step.body}</div>
              <div className="tour-card-foot">
                <div className="tour-dots" aria-hidden="true">
                  {STEPS.map((_, i) => (
                    <span key={i} className={`tour-dot ${i === tourStep ? "tour-dot-on" : ""}`} />
                  ))}
                </div>
                <div className="tour-nav">
                  <button className="tour-skip" onClick={endTour}>
                    Skip
                  </button>
                  {tourStep! > 0 && (
                    <motion.button
                      className="tour-btn"
                      aria-label="Back"
                      onClick={() => setTourStep(tourStep! - 1)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ArrowLeft size={14} strokeWidth={1.5} />
                    </motion.button>
                  )}
                  <motion.button
                    className="tour-btn tour-next"
                    onClick={() => (last ? endTour() : setTourStep(tourStep! + 1))}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {last ? "Finish" : "Next"}
                    {!last && <ArrowRight size={14} strokeWidth={1.5} />}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
