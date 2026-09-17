import { isLocale, type Locale } from '@world-quiz/quiz/domain';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ColorScheme = 'light' | 'dark';

export interface AppSettings {
  readonly theme: ThemePreference;
  readonly locale: Locale;
}

/** Storage key. The version suffix allows a future format change with a migration. */
export const SETTINGS_STORAGE_KEY = 'wq.settings.v1';

export function isThemePreference(value: unknown): value is ThemePreference {
  return (
    typeof value === 'string' &&
    (THEME_PREFERENCES as readonly string[]).includes(value)
  );
}

/** The scheme to render: an explicit choice wins, `system` follows the OS. */
export function resolveColorScheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ColorScheme {
  if (preference === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Reads stored settings defensively: malformed JSON or unknown values fall
 * back field by field, so a corrupted value never breaks app start-up.
 */
export function parseStoredSettings(
  raw: string | null,
  fallback: AppSettings,
): AppSettings {
  if (!raw) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (typeof parsed !== 'object' || parsed === null) return fallback;

  const { theme, locale } = parsed as Record<string, unknown>;
  return {
    theme: isThemePreference(theme) ? theme : fallback.theme,
    locale: isLocale(locale) ? locale : fallback.locale,
  };
}
