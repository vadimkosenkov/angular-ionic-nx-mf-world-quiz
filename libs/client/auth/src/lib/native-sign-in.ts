import { InjectionToken } from '@angular/core';
import type { IdentityProvider } from '@world-quiz/shared/contracts';

/** What a provider's own sign-in gives the app: an ID token for the API. */
export interface NativeCredential {
  readonly provider: IdentityProvider;
  readonly idToken: string;
  /** The nonce the app asked the provider to put into the token. */
  readonly nonce: string;
}

/**
 * Signing in through the operating system rather than through a web page.
 *
 * The web sign-in cannot work in the app: Google's sign-in is Google's own
 * page, and Google refuses to serve it inside an app's web view
 * (`disallowed_useragent`), because an app could read what the player types
 * there. On iOS the app asks the system instead — the account picker belongs
 * to iOS and Google, and the app only receives the resulting ID token, which
 * the API verifies exactly as it verifies the web one.
 */
export interface NativeSignIn {
  /** Opens the provider's own sign-in. Rejects if the player cancels. */
  signIn(): Promise<NativeCredential>;
}

/** `null` on the web, and in an app whose build has no provider configured. */
export const NATIVE_SIGN_IN = new InjectionToken<NativeSignIn | null>(
  'NATIVE_SIGN_IN',
  { providedIn: 'root', factory: () => null },
);
