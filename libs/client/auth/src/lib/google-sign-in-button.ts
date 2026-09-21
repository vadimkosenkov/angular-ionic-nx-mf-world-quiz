import {
  afterNextRender,
  afterRenderEffect,
  Component,
  type ElementRef,
  ErrorHandler,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AUTH_CONFIG } from './auth.config';
import {
  createNonce,
  type GoogleAccountsId,
  GoogleIdentityServices,
} from './google-identity';

/** What Google returned: the ID token and the nonce it was issued for. */
export interface GoogleCredential {
  readonly idToken: string;
  readonly nonce: string;
}

// TODO(design): Google's button does not match the app's design, and its
// language is not reliably ours. Google draws it in an iframe: corner radius
// (4px or pill), font and padding are fixed, and Google may ignore `locale`
// (`hl`) in favour of the language of the Google account signed in to the
// browser. To check and improve later:
// - whether a later GIS version honours `locale` for signed-in browsers;
// - or replace it with our own button (Google's branding rules for custom
//   buttons: white, dark #131314 or neutral) that starts an OpenID Connect
//   `response_type=id_token` sign-in with our nonce in a popup; the API stays
//   the same, but the redirect URI must be registered in Google Cloud Console.

/**
 * Google's own "Sign in with Google" button (Google's branding rules require
 * their button), rendered by Google Identity Services into this component.
 * Emits the ID token; exchanging it for our session is up to the page.
 */
@Component({
  selector: 'wq-google-sign-in-button',
  template: `
    <div #button class="button" data-testid="google-button"></div>
    @if (failed()) {
      <p class="error" role="alert">{{ unavailableText() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .button {
      display: flex;
      justify-content: center;
      min-height: 44px;
      /* Google's button is an iframe with a light document. When the page is
         dark, browsers paint an opaque white backdrop behind an iframe whose
         colour scheme differs from its embedder's; matching it keeps the
         backdrop transparent around the rounded button. */
      color-scheme: light;
      /* The iframe is larger than the button inside it, so a box-shadow
         would outline the iframe; a drop-shadow follows the button. */
      filter: var(--wq-drop-shadow-control);
    }
    .error {
      margin: 0;
      text-align: center;
      font-size: var(--wq-font-size-caption);
      color: var(--wq-color-text-secondary);
    }
  `,
})
export class GoogleSignInButton {
  /** Shown when Google's script cannot be loaded (offline, blocked). */
  readonly unavailableText = input.required<string>();
  /**
   * Asked of Google, which may still prefer the language of the Google
   * account signed in to this browser: the button is Google's page.
   */
  readonly locale = input<string>('en');

  readonly credential = output<GoogleCredential>();

  private readonly config = inject(AUTH_CONFIG);
  private readonly google = inject(GoogleIdentityServices);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly container =
    viewChild.required<ElementRef<HTMLElement>>('button');
  /** Google Identity Services, once loaded and initialised. */
  private readonly accounts = signal<GoogleAccountsId | null>(null);
  protected readonly failed = signal(false);

  constructor() {
    afterNextRender(() => void this.load());

    // Google renders its button once and cannot change it, so it is drawn
    // again whenever the app's language changes.
    afterRenderEffect(() => {
      const accounts = this.accounts();
      const locale = this.locale();
      if (!accounts) return;

      const element = this.container().nativeElement;
      element.replaceChildren();
      accounts.renderButton(element, {
        type: 'standard',
        // White in both themes: the filled styles put the logo on a white
        // square that looks patched on, and black is left to Apple.
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'center',
        width: Math.min(element.clientWidth || 320, 400),
        locale,
      });
    });
  }

  private async load(): Promise<void> {
    const clientId = this.config.googleClientId;
    if (!clientId) {
      this.failed.set(true);
      return;
    }
    try {
      const accounts = await this.google.load();
      const nonce = createNonce();
      accounts.initialize({
        client_id: clientId,
        nonce,
        callback: ({ credential }) =>
          this.credential.emit({ idToken: credential, nonce }),
        use_fedcm_for_button: true,
        itp_support: true,
      });
      this.accounts.set(accounts);
    } catch (error) {
      this.errorHandler.handleError(error);
      this.failed.set(true);
    }
  }
}
