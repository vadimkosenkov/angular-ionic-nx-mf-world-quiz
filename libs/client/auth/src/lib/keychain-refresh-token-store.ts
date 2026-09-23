import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { RefreshTokenStore } from './refresh-token-store';

/** One entry in the Keychain, under the app's own service. */
const KEY = 'refresh-token';

/**
 * The iPhone app's refresh token, in the **Keychain** (through
 * `@aparajita/capacitor-secure-storage`, which stores it as a generic
 * password item; iOS protects it and other apps cannot read it).
 *
 * Deliberately **not** `localStorage` or Capacitor Preferences: both are
 * plain files in the app's container, readable from a backup or a
 * jailbroken device. The token is what would let someone sign in as the
 * player for 30 days.
 *
 * `synchronize` is off, so the token never travels to iCloud Keychain and
 * therefore never reaches the player's other devices — each device signs in
 * for itself and gets its own token family (ADR-010).
 */
export function keychainRefreshTokenStore(): RefreshTokenStore {
  const ready = SecureStorage.setSynchronize(false).catch(() => undefined);

  return {
    delivery: 'body',

    async read() {
      await ready;
      // `getItem` returns the string it stored, or null when there is none.
      return SecureStorage.getItem(KEY);
    },

    async save(token: string) {
      await ready;
      await SecureStorage.set(KEY, token, true, false);
    },

    async clear() {
      await ready;
      // Removing something that is not there is not an error here.
      await SecureStorage.remove(KEY).catch(() => undefined);
    },
  };
}
