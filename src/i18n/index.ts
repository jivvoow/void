import { useSettings } from '../state/SettingsContext';
import type { Locale } from '../types';
import { en } from './en';
import { ko, type Strings } from './ko';

const tables: Record<Locale, Strings> = { ko, en };

/** Returns the string table for the current locale. */
export function useStrings(): Strings {
  const { settings } = useSettings();
  return tables[settings.locale] ?? ko;
}

export type { Strings };
