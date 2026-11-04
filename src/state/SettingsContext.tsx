import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_FADE_DELAY, FADE_DELAY_OPTIONS } from '../constants/config';
import type { Settings } from '../types';

/**
 * Only PREFERENCES are persisted here (timer, haptics, …) plus the "guide seen" flag.
 * The user's text is never stored anywhere — it does not pass through this module.
 */
const STORAGE_KEY = 'void.settings.v1';

const DEFAULT_SETTINGS: Settings = {
  fadeDelay: DEFAULT_FADE_DELAY,
  haptics: true,
  sound: false,
  animationLevel: 'full',
  locale: 'ko',
  onboarded: false,
};

/** Accept only known values so a corrupted / older blob can't break the app. */
function sanitize(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  if (FADE_DELAY_OPTIONS.includes(r.fadeDelay as Settings['fadeDelay'])) s.fadeDelay = r.fadeDelay as Settings['fadeDelay'];
  if (typeof r.haptics === 'boolean') s.haptics = r.haptics;
  if (typeof r.sound === 'boolean') s.sound = r.sound;
  if (r.animationLevel === 'soft' || r.animationLevel === 'full') s.animationLevel = r.animationLevel;
  if (r.locale === 'ko' || r.locale === 'en') s.locale = r.locale;
  if (typeof r.onboarded === 'boolean') s.onboarded = r.onboarded;
  return s;
}

interface SettingsValue {
  settings: Settings;
  /** False until stored preferences have been read (keeps the splash up). */
  hydrated: boolean;
  update: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        if (json) setSettings(sanitize(JSON.parse(json)));
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<SettingsValue>(() => ({ settings, hydrated, update }), [settings, hydrated, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}
