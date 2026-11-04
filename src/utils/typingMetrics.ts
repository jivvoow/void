import type { Intensity } from '../types';

/**
 * Typing-speed metrics (Phase 2).
 *
 * We deliberately measure INPUT EVENTS, not characters:
 * Korean IME composition ("ㅎ" → "하" → "한") changes the text on every keystroke
 * without always changing its length, so counting `onChangeText` events is the
 * honest keystroke signal. Text content is never inspected.
 */
export interface TypingTracker {
  /** Record one input event at time `t` (ms). */
  record: (t: number) => void;
  /** Events per second over the sliding window ending at `t`. */
  rate: (t: number) => number;
  reset: () => void;
}

export function createTypingTracker(windowMs = 2000, capacity = 64): TypingTracker {
  const stamps: number[] = [];
  const prune = (t: number) => {
    while (stamps.length && t - stamps[0] > windowMs) stamps.shift();
    if (stamps.length > capacity) stamps.splice(0, stamps.length - capacity);
  };
  return {
    record(t) {
      stamps.push(t);
      prune(t);
    },
    rate(t) {
      prune(t);
      return stamps.length / (windowMs / 1000);
    },
    reset() {
      stamps.length = 0;
    },
  };
}

/**
 * Events/sec thresholds. Phone keyboards: relaxed Korean typing ≈ 3–4 ev/s,
 * hurried ≈ 5–6, mashing / "아아아아아" ≈ 8+.
 */
export const INTENSITY_THRESHOLDS = { building: 4.5, burst: 7.5 } as const;

/** Hysteresis so the cloud doesn't flicker between bands. */
const HYSTERESIS = 1;

export function classifyIntensity(rate: number, previous: Intensity = 'calm'): Intensity {
  const { building, burst } = INTENSITY_THRESHOLDS;
  if (previous === 'burst' && rate > burst - HYSTERESIS) return 'burst';
  if (previous === 'building' && rate > building - HYSTERESIS && rate < burst) return 'building';
  if (rate >= burst) return 'burst';
  if (rate >= building) return 'building';
  return 'calm';
}
