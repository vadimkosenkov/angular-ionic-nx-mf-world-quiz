import { ErrorHandler } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { AUTH_CONFIG } from './auth.config';
import {
  createNonce,
  type GoogleAccountsId,
  GoogleIdentityServices,
} from './google-identity';
import {
  type GoogleCredential,
  GoogleSignInButton,
} from './google-sign-in-button';

/** Records what the component asks of Google Identity Services. */
function fakeGoogle() {
  let callback: ((response: { credential: string }) => void) | undefined;
  const calls: {
    clientId?: string;
    nonce?: string;
    rendered?: HTMLElement;
    renders: { theme: string; locale?: string }[];
  } = { renders: [] };
  const accounts: GoogleAccountsId = {
    initialize: (config) => {
      calls.clientId = config.client_id;
      calls.nonce = config.nonce;
      callback = config.callback;
    },
    renderButton: (parent, options) => {
      calls.rendered = parent;
      calls.renders.push({ theme: options.theme, locale: options.locale });
    },
  };
  return {
    calls,
    signIn: (credential: string) => callback?.({ credential }),
    service: { load: () => Promise.resolve(accounts) },
  };
}

async function renderButton(
  google: Pick<GoogleIdentityServices, 'load'>,
  googleClientId: string | null = 'client-id.apps.googleusercontent.com',
) {
  const emitted: GoogleCredential[] = [];
  const errors: unknown[] = [];
  const view = await render(GoogleSignInButton, {
    inputs: { unavailableText: 'Google sign-in is unavailable' },
    on: { credential: (value: GoogleCredential) => emitted.push(value) },
    providers: [
      { provide: GoogleIdentityServices, useValue: google },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => errors.push(error) },
      },
      {
        provide: AUTH_CONFIG,
        useValue: { apiUrl: 'http://api.test', googleClientId },
      },
    ],
  });
  await new Promise((resolve) => setTimeout(resolve));
  view.fixture.detectChanges();
  return { emitted, errors, view };
}

describe('GoogleSignInButton', () => {
  it("renders Google's button with our client id and a fresh nonce", async () => {
    const google = fakeGoogle();

    await renderButton(google.service);

    expect(google.calls.clientId).toBe('client-id.apps.googleusercontent.com');
    expect(google.calls.nonce).toMatch(/^[\w-]{43}$/);
    expect(google.calls.rendered).toBe(screen.getByTestId('google-button'));
  });

  it('emits the ID token together with the nonce it was issued for', async () => {
    const google = fakeGoogle();
    const { emitted } = await renderButton(google.service);

    google.signIn('header.payload.signature');

    expect(emitted).toEqual([
      { idToken: 'header.payload.signature', nonce: google.calls.nonce },
    ]);
  });

  it('draws the button again in the language of the app', async () => {
    const google = fakeGoogle();
    const { view } = await renderButton(google.service);
    expect(google.calls.renders.at(-1)).toEqual({
      theme: 'outline',
      locale: 'en',
    });

    view.fixture.componentRef.setInput('locale', 'ru');
    view.fixture.detectChanges();

    expect(google.calls.renders.at(-1)).toEqual({
      theme: 'outline',
      locale: 'ru',
    });
  });

  it('explains when Google cannot be loaded, and reports why', async () => {
    const failure = new Error('offline');
    const { errors } = await renderButton({
      load: () => Promise.reject(failure),
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'Google sign-in is unavailable',
    );
    expect(errors).toEqual([failure]);
  });

  it('explains when no Google client id is configured', async () => {
    await renderButton(fakeGoogle().service, null);

    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('createNonce', () => {
  it('is 256 random bits, URL-safe, different every time', () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createNonce()));

    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[\w-]{43}$/);
  });
});
