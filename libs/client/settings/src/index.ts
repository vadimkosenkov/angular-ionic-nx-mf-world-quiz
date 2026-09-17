export { DEVICE_LANGUAGES, SYSTEM_PREFERS_DARK } from './lib/environment';
export {
  isThemePreference,
  parseStoredSettings,
  resolveColorScheme,
  SETTINGS_STORAGE_KEY,
  THEME_PREFERENCES,
} from './lib/settings';
export type { AppSettings, ColorScheme, ThemePreference } from './lib/settings';
export {
  DARK_PALETTE_CLASS,
  DocumentSettingsSync,
  provideAppSettings,
} from './lib/settings.providers';
export { SettingsStore } from './lib/settings.store';
export {
  capacitorPreferencesStorage,
  createMemoryStorage,
  KEY_VALUE_STORAGE,
} from './lib/storage';
export type { KeyValueStorage, MemoryStorage } from './lib/storage';
