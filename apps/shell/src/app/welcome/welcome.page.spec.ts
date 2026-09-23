import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { render, screen } from '@testing-library/angular';
import {
  AuthStore,
  type GoogleAccountsId,
  GoogleIdentityServices,
} from '@world-quiz/client/auth';
import { ProgressStore } from '@world-quiz/client/progress';
import { ANN } from '@world-quiz/client/progress/testing';
import type { Locale } from '@world-quiz/quiz/domain';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { NATIVE_SIGN_IN, type NativeSignIn } from '@world-quiz/client/auth';
import { NATIVE_PLATFORM } from '../core/platform';
import { DEFAULT_RUNTIME_CONFIG, RUNTIME_CONFIG } from '../runtime-config';
import { WelcomePage } from './welcome.page';

const settle = () => new Promise((resolve) => setTimeout(resolve));

/** A Google Identity Services fake whose button "signs in" on demand. */
function fakeGoogle() {
  let signIn: ((response: { credential: string }) => void) | undefined;
  const accounts: GoogleAccountsId = {
    initialize: (config) => (signIn = config.callback),
    renderButton: () => undefined,
  };
  return {
    load: () => Promise.resolve(accounts),
    signIn: (credential: string) => signIn?.({ credential }),
  };
}

interface NativeOptions {
  /** The system's own sign-in, when this build has one. */
  readonly signIn?: NativeSignIn;
  /** A development build may offer the API's development sign-in. */
  readonly devSignIn?: boolean;
}

async function renderWelcome(
  locale: Locale = 'en',
  native = false,
  options: NativeOptions = {},
) {
  const google = fakeGoogle();
  const roots: string[] = [];
  const view = await render(WelcomePage, {
    providers: [
      ...provideShellTesting({ locale }),
      { provide: NATIVE_PLATFORM, useValue: native },
      { provide: NATIVE_SIGN_IN, useValue: options.signIn ?? null },
      {
        provide: RUNTIME_CONFIG,
        useValue: {
          ...DEFAULT_RUNTIME_CONFIG,
          devSignIn: options.devSignIn ?? false,
        },
      },
      { provide: GoogleIdentityServices, useValue: google },
      {
        provide: NavController,
        useValue: { navigateRoot: (url: string) => roots.push(url) },
      },
    ],
  });
  await settle();
  await view.fixture.whenStable();
  return {
    ...view,
    google,
    roots,
    http: TestBed.inject(HttpTestingController),
  };
}

/** Each count as a screen reader reads its list item. */
const stats = () =>
  screen
    .getAllByRole('listitem')
    .map((item) => item.textContent?.replace(/\s+/g, ' ').trim());

describe('WelcomePage', () => {
  it('says what the app is, with real counts, and offers sign-in', async () => {
    await renderWelcome();

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'World Quiz',
    );
    expect(stats()).toEqual(['195 Countries', '6 Regions', '3 Modes']);
    expect(screen.getByTestId('google-button')).toBeTruthy();
    expect(screen.getByTestId('apple-unavailable').textContent).toContain(
      'Sign in with Apple arrives with the iPhone app.',
    );
  });

  it('uses Russian plural forms for the counts', async () => {
    await renderWelcome('ru');

    expect(stats()).toEqual(['195 стран', '6 регионов', '3 режима']);
  });

  it('signs in with Google, claims the device for the player and opens the app', async () => {
    const { google, http, roots } = await renderWelcome();

    google.signIn('header.payload.signature');
    const request = http.expectOne(`${TEST_API_URL}/v1/auth/google`);
    expect(request.request.body).toMatchObject({
      idToken: 'header.payload.signature',
    });
    request.flush({
      user: ANN,
      accessToken: 'access-1',
      accessTokenExpiresAt: '2026-09-21T10:15:00.000Z',
    });
    for (let i = 0; i < 5; i++) await settle();

    expect(TestBed.inject(AuthStore).status()).toBe('signed-in');
    expect(TestBed.inject(ProgressStore).owner()).toEqual(ANN);
    expect(roots).toEqual(['/home']);
  });

  it('explains a failed sign-in and stays', async () => {
    const { google, http, roots, fixture } = await renderWelcome();

    google.signIn('header.payload.signature');
    http
      .expectOne(`${TEST_API_URL}/v1/auth/google`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    fixture.detectChanges();

    expect(screen.getByTestId('welcome-error').textContent).toContain(
      'Sign-in did not work.',
    );
    expect(roots).toEqual([]);
  });

  // The iPhone app cannot show Google's sign-in page inside its web view: it
  // asks the system instead, and says so when a build has no provider.
  it('signs in through the system in the app', async () => {
    const credential = {
      provider: 'google' as const,
      idToken: 'ios.id.token',
      nonce: 'ios-nonce',
    };
    const view = await renderWelcome('en', true, {
      signIn: { signIn: () => Promise.resolve(credential) },
    });

    // Google's web button is never rendered in the app.
    expect(screen.queryByTestId('google-button')).toBeNull();
    screen.getByTestId('native-google-sign-in').click();
    await settle();

    const request = view.http.expectOne(`${TEST_API_URL}/v1/auth/google`);
    expect(request.request.body).toMatchObject({
      idToken: credential.idToken,
      nonce: credential.nonce,
    });
    request.flush({}, { status: 500, statusText: 'Server Error' });
    await settle();
  });

  it('says so when the app build has no sign-in configured', async () => {
    await renderWelcome('en', true);

    expect(screen.getByTestId('native-sign-in-pending').textContent).toContain(
      'no Google sign-in configured',
    );
    expect(screen.queryByTestId('native-google-sign-in')).toBeNull();
    expect(screen.queryByTestId('dev-sign-in')).toBeNull();
  });

  it('offers the development sign-in only when the build asks for it', async () => {
    await renderWelcome('en', true, { devSignIn: true });

    expect(screen.getByTestId('dev-sign-in')).toBeTruthy();
  });
});
