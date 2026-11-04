import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

import { useSettings } from '../state/SettingsContext';

const swallow = () => {};

/** Thin wrapper so every haptic respects the Settings toggle and never throws. */
export function useHaptics() {
  const { settings } = useSettings();
  const on = settings.haptics;
  return useMemo(
    () => ({
      tick: () => on && Haptics.selectionAsync().catch(swallow),
      soft: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(swallow),
      light: () => on && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(swallow),
      done: () => on && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(swallow),
    }),
    [on],
  );
}
