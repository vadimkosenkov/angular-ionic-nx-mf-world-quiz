import { InjectionToken } from '@angular/core';
import type { RefreshTokenDelivery } from '@world-quiz/shared/contracts';

/**
 * Where this platform keeps the refresh token — the long-lived secret that
 * signs the player in again after a restart.
 *
 * On the **web** the API sets it as an httpOnly cookie: the browser stores
 * and sends it, and JavaScript never sees it. That is the safest option
 * there, but it does not exist in a native app: its web view has no domain
 * to scope a cookie to, and a cookie in a web view is not protected storage.
 *
 * On **iOS** the API returns the token in the response body instead
 * (`refreshTokenIn: 'body'`, ADR-010) and the app keeps it in the Keychain.
 */
export interface RefreshTokenStore {
  /** What the client asks the API to do with a new refresh token. */
  readonly delivery: RefreshTokenDelivery;
  /** The stored token, or `null` when the platform keeps it itself. */
  read(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * The web: the browser holds the cookie, so there is nothing to store and
 * nothing to read. Signing out clears it through the API's response.
 */
export const cookieRefreshTokenStore: RefreshTokenStore = {
  delivery: 'cookie',
  read: () => Promise.resolve(null),
  save: () => Promise.resolve(),
  clear: () => Promise.resolve(),
};

export const REFRESH_TOKEN_STORE = new InjectionToken<RefreshTokenStore>(
  'REFRESH_TOKEN_STORE',
  { providedIn: 'root', factory: () => cookieRefreshTokenStore },
);
