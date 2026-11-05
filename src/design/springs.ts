import type { Transition } from "motion/react";

export const spring: Transition = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 35 };
export const springSoft: Transition = { type: "spring", stiffness: 180, damping: 24 };

export const springBouncy: Transition = { type: "spring", stiffness: 560, damping: 24 };

export const panelExit: Transition = { type: "tween", duration: 0.18, ease: [0.4, 0, 1, 1] };

export const QUICK_FADE: Transition = { type: "tween", duration: 0.1, ease: "easeOut" };

const BASE = new Map<Transition, Transition>(
  [spring, springSnappy, springSoft, springBouncy, panelExit].map((t) => [t, { ...t }]),
);

let quick = false;

export function setQuickMotion(on: boolean) {
  quick = on;
  for (const [target, base] of BASE) {
    const record = target as Record<string, unknown>;
    for (const key of Object.keys(record)) delete record[key];
    Object.assign(record, on ? QUICK_FADE : base);
  }
}

export function isQuickMotion(): boolean {
  return quick;
}

export const STAGGER_CAP = 14;
export const STAGGER_STEP = 0.04;

export function staggerDelay(index: number): number {
  if (quick) return 0;
  return Math.min(index, STAGGER_CAP) * STAGGER_STEP;
}
