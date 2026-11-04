import { useCallback, useRef } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { RELEASE_HOLD_MS } from '../constants/config';

interface Options {
  disabled: boolean;
  onHoldStart?: () => void;
  onRelease: () => void;
  /** Let go before the hold completed — a chance to teach "hold, don't tap". */
  onShortTap?: () => void;
}

/**
 * Shared "press and hold to release" gesture. Several targets (the cloud itself and the
 * "훌훌 날리기" chip) can spread the same handlers and read the same `hold` progress,
 * so they always animate together.
 */
export function useHoldToRelease({ disabled, onHoldStart, onRelease, onShortTap }: Options) {
  const hold = useSharedValue(0);
  const latest = useRef({ disabled, onHoldStart, onRelease, onShortTap });
  latest.current = { disabled, onHoldStart, onRelease, onShortTap };

  const fire = useCallback(() => {
    if (!latest.current.disabled) latest.current.onRelease();
  }, []);

  const onPressIn = useCallback(() => {
    if (latest.current.disabled) return;
    latest.current.onHoldStart?.();
    hold.value = withTiming(1, { duration: RELEASE_HOLD_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) scheduleOnRN(fire);
    });
  }, [hold, fire]);

  const onPressOut = useCallback(() => {
    const early = hold.value < 1;
    // Starting a new timing cancels the in-flight one → its callback gets finished=false.
    hold.value = withTiming(0, { duration: early ? 220 : 600 });
    if (early && !latest.current.disabled) latest.current.onShortTap?.();
  }, [hold]);

  return { hold, onPressIn, onPressOut };
}
