import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { GRACE_WINDOW_MS } from '../constants/config';

interface Options {
  /** Inactivity before fading, in ms. `null` disables auto-fade. */
  delayMs: number | null;
  /** Only count down while there is text and nothing else is happening. */
  armed: boolean;
  /** Entered the cancellable window. Receives the ms left until the fade. */
  onGrace: (remainingMs: number) => void;
  /** Time is up — start the fade. */
  onExpire: () => void;
}

/**
 * Inactivity timer measured from the LAST input.
 *
 * - `touch()` on every input event resets the countdown.
 * - Uses two one-shot timeouts (grace start + expiry) instead of a ticking interval,
 *   so nothing runs while the user is just reading their text.
 * - JS timers pause in the background; when the app becomes active again we
 *   recompute from wall-clock time, so an overdue note fades right away.
 */
export function useAutoFade({ delayMs, armed, onGrace, onExpire }: Options) {
  const lastInputAt = useRef(Date.now());
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest callbacks without re-scheduling on every render.
  const cbs = useRef({ onGrace, onExpire });
  cbs.current = { onGrace, onExpire };
  const cfg = useRef({ delayMs, armed });
  cfg.current = { delayMs, armed };

  const clear = useCallback(() => {
    if (graceTimer.current) clearTimeout(graceTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
    graceTimer.current = expireTimer.current = null;
  }, []);

  const schedule = useCallback(() => {
    clear();
    const { delayMs: delay, armed: on } = cfg.current;
    if (!on || delay == null) return;

    const remaining = delay - (Date.now() - lastInputAt.current);
    if (remaining <= 0) {
      cbs.current.onExpire();
      return;
    }
    const grace = Math.min(GRACE_WINDOW_MS, delay);
    const untilGrace = remaining - grace;
    if (untilGrace <= 0) {
      cbs.current.onGrace(remaining);
    } else {
      graceTimer.current = setTimeout(() => cbs.current.onGrace(grace), untilGrace);
    }
    expireTimer.current = setTimeout(() => cbs.current.onExpire(), remaining);
  }, [clear]);

  /** Call on every input event (and to "keep" the text during the grace window). */
  const touch = useCallback(() => {
    lastInputAt.current = Date.now();
    schedule();
  }, [schedule]);

  useEffect(() => {
    schedule();
    return clear;
  }, [armed, delayMs, schedule, clear]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });
    return () => sub.remove();
  }, [schedule]);

  return { touch };
}
