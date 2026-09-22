import { DOCUMENT, inject, Injectable } from '@angular/core';

/**
 * The part of Google Identity Services (`google.accounts.id`) the app uses.
 * https://developers.google.com/identity/gsi/web/reference/js-reference
 */
export interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce: string;
    /** Keep Google's session state out of our pages' cookies. */
    use_fedcm_for_button?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline' | 'filled_blue' | 'filled_black';
      size: 'large';
      text: 'signin_with' | 'continue_with';
      shape: 'rectangular' | 'pill';
      logo_alignment?: 'left' | 'center';
      width?: number;
      locale?: string;
    },
  ): void;
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/**
 * Loads Google Identity Services once, on demand.
 *
 * Why not a Capacitor plugin on the web: the plugin's web implementation keeps
 * Google's tokens in `localStorage` and needs a redirect URI per page; GIS
 * hands the ID token straight to a callback and needs only the JavaScript
 * origin. The native iOS app uses the provider SDKs instead (Phase 13).
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityServices {
  private readonly document = inject(DOCUMENT);
  private loading: Promise<GoogleAccountsId> | null = null;

  load(): Promise<GoogleAccountsId> {
    this.loading ??= new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const api = (
          this.document.defaultView as
            | (Window & { google?: { accounts?: { id?: GoogleAccountsId } } })
            | null
        )?.google?.accounts?.id;
        if (api) resolve(api);
        else reject(new Error('Google Identity Services did not initialise'));
      };
      // Offline, or blocked: content blockers' "annoyance" lists often
      // block accounts.google.com/gsi to hide Google's One Tap prompt.
      script.onerror = () => {
        script.remove();
        reject(new Error('Google Identity Services failed to load'));
      };
      this.document.head.appendChild(script);
    }).catch((error: unknown) => {
      // Allow a later attempt, e.g. after the network comes back.
      this.loading = null;
      throw error;
    });
    return this.loading;
  }
}

/**
 * A fresh, unguessable nonce for one sign-in: 32 random bytes, base64url.
 * Google puts it into the ID token; the API checks it matches.
 */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
