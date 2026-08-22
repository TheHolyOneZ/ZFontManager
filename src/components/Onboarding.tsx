import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { spring, springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { t as translate, useT, type TKey } from "../lib/i18n";

interface TourStep {

  target?: string;
  title: TKey;
  body: TKey;

  onEnter?: () => void;
}

const STEPS: TourStep[] = [
  {
    title: "tour.welcome.title",
    body: "tour.welcome.body",
  },
  {
    target: ".topbar-sample",
    title: "tour.sample.title",
    body: "tour.sample.body",
  },
  {
    target: ".topbar-size",
    title: "tour.size.title",
    body: "tour.size.body",
  },
  {
    target: ".topbar-search",
    title: "tour.search.title",
    body: "tour.search.body",
  },
  {
    target: ".view-toggle",
    title: "tour.views.title",
    body: "tour.views.body",
    onEnter: () => useFontStore.setState({ viewMode: "grid" }),
  },
  {
    target: ".family-card",
    title: "tour.card.title",
    body: "tour.card.body",
    onEnter: () => useFontStore.setState({ viewMode: "grid" }),
  },
  {
    target: ".detail",
    title: "tour.inspector.title",
    body: "tour.inspector.body",
    onEnter: () => {
      const st = useFontStore.getState();
      if (!st.selectedFamily && st.visibleOrder.length > 0) {
        st.select(st.visibleOrder[0]);
      }
    },
  },
  {
    target: ".sidebar-heading-row",
    title: "tour.collections.title",
    body: "tour.collections.body",
    onEnter: () => useFontStore.getState().select(null),
  },
  {
    target: ".sidebar-footer",
    title: "tour.trash.title",
    body: "tour.trash.body",
  },
  {
    target: '[data-tour="settings"]',
    title: "tour.settings.title",
    body: "tour.settings.body",
  },
  {
    title: "tour.last.title",
    body: "tour.last.body",
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
  const t = useT();
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
            aria-label={t("tour.inviteAria")}
          >
            <img className="tour-invite-icon" src="/icon.png" alt="" draggable={false} />
            <div className="tour-invite-text">
              <div className="tour-invite-title">{t("tour.inviteTitle")}</div>
              <div className="tour-invite-sub">{t("tour.inviteSub")}</div>
            </div>
            <motion.button
              className="tour-start"
              onClick={startTour}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              {t("tour.take")}
            </motion.button>
            <button className="detail-close" aria-label={t("tour.skipAria")} onClick={endTour}>
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
              aria-label={translate(step.title)}
            >
              <div className="tour-card-title">{t(step.title)}</div>
              <div className="tour-card-body">{t(step.body)}</div>
              <div className="tour-card-foot">
                <div className="tour-dots" aria-hidden="true">
                  {STEPS.map((_, i) => (
                    <span key={i} className={`tour-dot ${i === tourStep ? "tour-dot-on" : ""}`} />
                  ))}
                </div>
                <div className="tour-nav">
                  <button className="tour-skip" onClick={endTour}>
                    {t("tour.skip")}
                  </button>
                  {tourStep! > 0 && (
                    <motion.button
                      className="tour-btn"
                      aria-label={t("tour.back")}
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
                    {t(last ? "tour.finish" : "tour.next")}
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
