import { InjectionToken } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Minimal async key-value storage for small, non-sensitive values (settings).
 * Sensitive data (auth tokens) must never use it; see the authentication phase.
 */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Capacitor Preferences: UserDefaults on iOS, SharedPreferences on Android,
 * `localStorage` on the web. Unlike WebView storage, native preferences are
 * not cleared when iOS reclaims website data.
 */
export const capacitorPreferencesStorage: KeyValueStorage = {
  async get(key) {
    return (await Preferences.get({ key })).value;
  },
  async set(key, value) {
    await Preferences.set({ key, value });
  },
  async remove(key) {
    await Preferences.remove({ key });
  },
};

export const KEY_VALUE_STORAGE = new InjectionToken<KeyValueStorage>(
  'KEY_VALUE_STORAGE',
  { providedIn: 'root', factory: () => capacitorPreferencesStorage },
);

/** In-memory storage for tests and previews. */
export interface MemoryStorage extends KeyValueStorage {
  snapshot(): Readonly<Record<string, string>>;
}

export function createMemoryStorage(
  initial: Readonly<Record<string, string>> = {},
): MemoryStorage {
  const values = new Map(Object.entries(initial));
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
    snapshot: () => Object.fromEntries(values),
  };
}
