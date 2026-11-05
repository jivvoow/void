import {
  Easing,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { CloudMood } from '../types';

/** Per-mood targets. Phase 2 drives building/burst from typing speed. */
export const CLOUD_MOOD_TARGETS: Record<CloudMood, { scale: number; pink: number; glow: number }> = {
  rest: { scale: 1, pink: 0, glow: 0.55 },
  calm: { scale: 1.02, pink: 0.12, glow: 0.6 },
  building: { scale: 1.08, pink: 0.55, glow: 0.8 },
  burst: { scale: 1.15, pink: 1, glow: 1 },
  fade: { scale: 1, pink: 0, glow: 0.9 },
};

const sine = Easing.inOut(Easing.sin);

/** Endless gentle bob. `amplitude` in px. */
export function floatLoop(amplitude: number, durationMs = 3400) {
  'worklet';
  return withRepeat(
    withSequence(
      withTiming(-amplitude, { duration: durationMs / 2, easing: sine }),
      withTiming(0, { duration: durationMs / 2, easing: sine }),
    ),
    -1,
  );
}

/** Slow breathing (scale around 1). Faster & deeper when agitated. */
export function breathLoop(depth: number, durationMs = 4200) {
  'worklet';
  return withRepeat(
    withSequence(
      withTiming(1 + depth, { duration: durationMs / 2, easing: sine }),
      withTiming(1, { duration: durationMs / 2, easing: sine }),
    ),
    -1,
  );
}

/** Settle into a mood's size with a soft, slightly bouncy spring. */
export function toMoodScale(target: number) {
  'worklet';
  return withSpring(target, { damping: 14, stiffness: 120, mass: 0.9 });
}
