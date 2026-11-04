import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_FADE_DELAY } from '../constants/config';
import type { Settings } from '../types';

const DEFAULT_SETTINGS: Settings = {
  fadeDelay: DEFAULT_FADE_DELAY,
  haptics: true,
  sound: false,
  animationLevel: 'full',
  locale: 'ko',
};

interface SettingsValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

/**
 * Settings live in memory for Phase 1.
 * (Persisting preferences — never the user's text — can be added later with
 * expo-secure-store / AsyncStorage without touching consumers.)
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const value = useMemo<SettingsValue>(
    () => ({ settings, update: (patch) => setSettings((s) => ({ ...s, ...patch })) }),
    [settings],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
