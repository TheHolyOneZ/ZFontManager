export const WHEEL_STEP_PX = 40;
export const WHEEL_IDLE_MS = 350;

export interface WheelState {
  acc: number;
  at: number;
}

export function wheelPixels(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * 400;
  return deltaY;
}

export function wheelStep(state: WheelState, pixels: number, now: number): -1 | 0 | 1 {
  if (now - state.at > WHEEL_IDLE_MS || Math.sign(pixels) !== Math.sign(state.acc)) state.acc = 0;
  state.at = now;
  state.acc += pixels;
  if (Math.abs(state.acc) < WHEEL_STEP_PX) return 0;
  const step = state.acc < 0 ? 1 : -1;
  state.acc = 0;
  return step;
}

export function stepIndex(index: number, step: number, count: number): number {
  return Math.min(count - 1, Math.max(0, index + step));
}
