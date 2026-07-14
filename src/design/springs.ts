
import type { Transition } from "motion/react";

export const spring: Transition = { type: "spring", stiffness: 300, damping: 30, mass: 1 };
export const springSnappy: Transition = { type: "spring", stiffness: 500, damping: 35 };
export const springSoft: Transition = { type: "spring", stiffness: 180, damping: 24 };

export const springBouncy: Transition = { type: "spring", stiffness: 560, damping: 24 };


export const STAGGER_CAP = 14;
export const STAGGER_STEP = 0.04;

export function staggerDelay(index: number): number {
  return Math.min(index, STAGGER_CAP) * STAGGER_STEP;
}
