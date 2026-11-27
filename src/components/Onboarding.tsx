import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { springSoft } from "../design/springs";
import { useFontStore } from "../state/fontStore";
import { t as translate, useT, type TKey } from "../lib/i18n";
import VariableProximity from "./VariableProximity";

type Chapter = "start" | "find" | "preview" | "manage" | "organize" | "yours";

interface TourStep {
  target?: string[];
  chapter: Chapter;
  title: TKey;
  body: TKey;
  keys?: string[];
  onEnter?: () => void;
  onLeave?: () => void;
}

const MOD = navigator.platform.toUpperCase().includes("MAC") ? "⌘" : "Ctrl";

const firstCard = () => {
  const st = useFontStore.getState();
  if (st.viewMode !== "grid") st.setViewMode("grid");
};

const STEPS: TourStep[] = [
  { chapter: "start", title: "tour.welcome.title", body: "tour.welcome.body" },
  { chapter: "find", target: ['[data-tour="browse"]'], title: "tour.browse.title", body: "tour.browse.body" },
  {
    chapter: "find",
    target: ['[data-tour="sidebar-edge"]'],
    title: "tour.sidebar.title",
    body: "tour.sidebar.body",
  },
  { chapter: "find", target: ['[data-tour="search"]'], title: "tour.search.title", body: "tour.search.body", keys: ["/"] },
  { chapter: "find", target: ['[data-tour="filter"]'], title: "tour.filter.title", body: "tour.filter.body" },
  { chapter: "find", target: ['[data-tour="sort"]'], title: "tour.sort.title", body: "tour.sort.body" },
  { chapter: "preview", target: ['[data-tour="sample"]'], title: "tour.sample.title", body: "tour.sample.body" },
  {
    chapter: "preview",
    target: ['[data-tour="size"]'],
    title: "tour.size.title",
    body: "tour.size.body",
    keys: [`${MOD} +`, `${MOD} −`, `${MOD} 0`],
  },
  { chapter: "preview", target: ['[data-tour="views"]'], title: "tour.views.title", body: "tour.views.body", onEnter: firstCard },
  {
    chapter: "preview",
    target: [".family-card"],
    title: "tour.card.title",
    body: "tour.card.body",
    onEnter: () => {
      firstCard();
      useFontStore.getState().select(null);
    },
  },
  {
    chapter: "manage",
    target: [".family-card .pill-toggle, .family-card .card-os-lock"],
    title: "tour.toggle.title",
    body: "tour.toggle.body",
    keys: ["Space"],
    onEnter: firstCard,
  },
  {
    chapter: "manage",
    target: [".family-card .select-box", ".family-card .star-btn"],
    title: "tour.pick.title",
    body: "tour.pick.body",
    keys: ["F", `${MOD} A`, "Shift"],
    onEnter: firstCard,
  },
  {
    chapter: "manage",
    target: [".detail"],
    title: "tour.inspector.title",
    body: "tour.inspector.body",
    onEnter: () => {
      const st = useFontStore.getState();
      if (st.visibleOrder.length > 0) st.select(st.visibleOrder[0]);
    },
    onLeave: () => useFontStore.getState().select(null),
  },
  {
    chapter: "manage",
    target: [".selection-bar"],
    title: "tour.selection.title",
    body: "tour.selection.body",
    keys: ["Delete"],
    onEnter: () => {
      const st = useFontStore.getState();
      const pick = st.visibleOrder.slice(0, 2);
      if (pick.length === 2) useFontStore.setState({ selection: pick, selectedFamily: null });
    },
    onLeave: () => useFontStore.getState().select(null),
  },
  { chapter: "manage", target: ['[data-tour="compare"]'], title: "tour.compare.title", body: "tour.compare.body", keys: ["C"] },
  {
    chapter: "manage",
    target: ['[data-tour="rescan"]', '[data-tour="select-all"]', '[data-tour="expand"]'],
    title: "tour.tools.title",
    body: "tour.tools.body",
    onEnter: firstCard,
  },
  { chapter: "organize", target: ['[data-tour="collections"]'], title: "tour.collections.title", body: "tour.collections.body" },
  { chapter: "organize", title: "tour.tags.title", body: "tour.tags.body", target: [".family-card"], onEnter: firstCard },
  { chapter: "organize", title: "tour.palette.title", body: "tour.palette.body", keys: [`${MOD} K`, "?"] },
  { chapter: "yours", target: ['[data-tour="settings"]'], title: "tour.settings.title", body: "tour.settings.body" },
  { chapter: "yours", target: ['[data-tour="sidebar-footer"]'], title: "tour.trash.title", body: "tour.trash.body" },
  { chapter: "yours", title: "tour.last.title", body: "tour.last.body" },
];

const CHAPTER_LABEL: Record<Chapter, TKey> = {
  start: "tour.ch.start",
  find: "tour.ch.find",
  preview: "tour.ch.preview",
  manage: "tour.ch.manage",
  organize: "tour.ch.organize",
  yours: "tour.ch.yours",
};

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function unionRect(selectors: string[]): Rect | null {
  const rects = selectors
    .map((s) => document.querySelector(s)?.getBoundingClientRect())
    .filter((r): r is DOMRect => Boolean(r) && r!.width > 0 && r!.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return { left, top, width: right - left, height: bottom - top };
}

function useTargetRect(selectors: string[] | undefined, step: number) {
  const [rect, setRect] = useState<Rect | null>(null);

  useLayoutEffect(() => {
    if (!selectors) {
      setRect(null);
      return;
    }
    let tries = 0;
    let raf = 0;
    const timers: number[] = [];
    const measure = () => setRect(unionRect(selectors));
    const find = () => {
      const el = document.querySelector(selectors[0]);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
        measure();
        timers.push(window.setTimeout(measure, 180), window.setTimeout(measure, 420));
      } else if (tries++ < 50) {
        raf = requestAnimationFrame(find);
      } else {
        setRect(null);
      }
    };
    find();
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("resize", measure);
    };
  }, [selectors, step]);

  return rect;
}

const PAD = 6;
const CARD_W = 348;
const MARGIN = 14;

function cardPosition(rect: Rect | null, cardH: number): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect) return { left: (vw - CARD_W) / 2, top: (vh - cardH) / 2 };
  const clampX = (x: number) => Math.min(Math.max(MARGIN, x), vw - CARD_W - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(MARGIN, y), vh - cardH - MARGIN);
  const bottom = rect.top + rect.height;
  const right = rect.left + rect.width;
  const centeredX = clampX(rect.left + rect.width / 2 - CARD_W / 2);

  if (bottom + PAD + MARGIN + cardH <= vh) return { left: centeredX, top: bottom + PAD + MARGIN };
  if (rect.top - PAD - MARGIN - cardH >= 0) return { left: centeredX, top: rect.top - PAD - MARGIN - cardH };
  const sideY = clampY(rect.top + rect.height / 2 - cardH / 2);
  if (right + PAD + MARGIN + CARD_W <= vw) return { left: right + PAD + MARGIN, top: sideY };
  if (rect.left - PAD - MARGIN - CARD_W >= 0) return { left: rect.left - PAD - MARGIN - CARD_W, top: sideY };
  return { left: centeredX, top: clampY(bottom + PAD + MARGIN) };
}

function quick(): boolean {
  return (
    document.documentElement.dataset.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
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
  const spotRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(200);
  const prevStep = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [tourStep, rect]);

  useEffect(() => {
    const prev = prevStep.current;
    if (prev !== null && prev !== tourStep) STEPS[prev]?.onLeave?.();
    prevStep.current = tourStep;
    if (tourStep !== null) STEPS[tourStep]?.onEnter?.();
  }, [tourStep]);

  useLayoutEffect(() => {
    const spot = spotRef.current;
    if (!spot || tourStep === null) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const to = rect
      ? { x: rect.left - PAD, y: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, autoAlpha: 1 }
      : { x: vw / 2, y: vh / 2, width: 0, height: 0, autoAlpha: 1 };
    gsap.to(spot, { ...to, duration: quick() ? 0 : 0.5, ease: "power3.inOut", overwrite: true });
  }, [rect, tourStep]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || tourStep === null) return;
    const pos = cardPosition(rect, cardH);
    const first = !card.dataset.placed;
    card.dataset.placed = "1";
    if (quick() || first) {
      gsap.set(card, { left: pos.left, top: pos.top });
      if (first) gsap.fromTo(card, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" });
      return;
    }
    gsap.to(card, { left: pos.left, top: pos.top, duration: 0.5, ease: "power3.inOut", overwrite: "auto" });
  }, [rect, cardH, tourStep]);

  useLayoutEffect(() => {
    const body = cardRef.current?.querySelector(".tour-card-content");
    if (!body || quick()) return;
    gsap.fromTo(body, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out", delay: 0.12 });
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
  const progress = tourStep !== null ? (tourStep + 1) / STEPS.length : 0;

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
            <motion.button className="tour-start" onClick={startTour} whileTap={{ scale: 0.97 }}>
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
            <div ref={spotRef} className={`tour-spotlight ${rect ? "" : "tour-spotlight-off"}`} />
            <div
              ref={cardRef}
              className={`tour-card glass-e3 ${tourStep === 0 ? "tour-card-hero" : ""}`}
              role="dialog"
              aria-label={translate(step.title)}
            >
              <div className="tour-progress" aria-hidden>
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <div className="tour-card-content">
                <div className="tour-card-meta">
                  <span>{t(CHAPTER_LABEL[step.chapter])}</span>
                  <span className="tabular">
                    {t("tour.stepOf", { step: (tourStep ?? 0) + 1, total: STEPS.length })}
                  </span>
                </div>
                <div className="tour-card-title">
                  {tourStep === 0 ? (
                    <VariableProximity
                      label={t(step.title)}
                      fromFontVariationSettings="'wght' 560"
                      toFontVariationSettings="'wght' 850"
                      radius={90}
                      falloff="gaussian"
                    />
                  ) : (
                    t(step.title)
                  )}
                </div>
                <div className="tour-card-body">{t(step.body, { mod: MOD })}</div>
                {step.keys && (
                  <div className="tour-keys">
                    {step.keys.map((k) => (
                      <kbd key={k} className="kbd">
                        {k}
                      </kbd>
                    ))}
                  </div>
                )}
              </div>
              <div className="tour-card-foot">
                <button className="tour-skip" onClick={endTour}>
                  {t("tour.skip")}
                </button>
                <div className="tour-nav">
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
                    whileTap={{ scale: 0.97 }}
                  >
                    {t(last ? "tour.finish" : "tour.next")}
                    {!last && <ArrowRight size={14} strokeWidth={1.5} />}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
