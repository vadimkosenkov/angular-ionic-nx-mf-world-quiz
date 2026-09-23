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
import { NATIVE_PLATFORM } from '../core/platform';
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

async function renderWelcome(locale: Locale = 'en', native = false) {
  const google = fakeGoogle();
  const roots: string[] = [];
  const view = await render(WelcomePage, {
    providers: [
      ...provideShellTesting({ locale }),
      { provide: NATIVE_PLATFORM, useValue: native },
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

  // The iPhone app cannot show Google's sign-in page inside its web view, so
  // it says so instead of rendering a button that would not work (Phase 13b
  // adds the native sign-in).
  it('says that signing in is not available in the iPhone app yet', async () => {
    await renderWelcome('en', true);

    expect(screen.getByTestId('native-sign-in-pending').textContent).toContain(
      'needs a native sign-in',
    );
    expect(screen.queryByTestId('google-button')).toBeNull();
  });
});
