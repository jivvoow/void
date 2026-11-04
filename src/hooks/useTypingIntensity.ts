import { useCallback, useEffect, useRef, useState } from 'react';

import type { Intensity } from '../types';
import { classifyIntensity, createTypingTracker } from '../utils/typingMetrics';

/**
 * Phase 2 — not wired into the UI yet.
 * Call `recordInput()` from `onChangeText`; `intensity` only changes when the band changes,
 * so this causes at most a handful of re-renders per burst.
 */
export function useTypingIntensity(decayMs = 900) {
  const tracker = useRef(createTypingTracker()).current;
  const [intensity, setIntensity] = useState<Intensity>('calm');
  const current = useRef<Intensity>('calm');
  const decayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const evaluate = useCallback(() => {
    const next = classifyIntensity(tracker.rate(Date.now()), current.current);
    if (next !== current.current) {
      current.current = next;
      setIntensity(next);
    }
  }, [tracker]);

  const recordInput = useCallback(() => {
    tracker.record(Date.now());
    evaluate();
    if (decayTimer.current) clearTimeout(decayTimer.current);
    // Re-evaluate after a pause so intensity settles back down without more input.
    decayTimer.current = setTimeout(function tick() {
      evaluate();
      if (current.current !== 'calm') decayTimer.current = setTimeout(tick, decayMs);
    }, decayMs);
  }, [tracker, evaluate, decayMs]);

  const reset = useCallback(() => {
    tracker.reset();
    if (decayTimer.current) clearTimeout(decayTimer.current);
    current.current = 'calm';
    setIntensity('calm');
  }, [tracker]);

  useEffect(() => () => {
    if (decayTimer.current) clearTimeout(decayTimer.current);
  }, []);

  return { intensity, recordInput, reset };
}
