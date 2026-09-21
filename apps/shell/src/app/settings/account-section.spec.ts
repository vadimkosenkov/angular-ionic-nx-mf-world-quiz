import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import {
  AuthStore,
  type GoogleAccountsId,
  GoogleIdentityServices,
} from '@world-quiz/client/auth';
import type { AuthResponse } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { AccountSection } from './account-section';

const signedIn = (
  overrides: Partial<AuthResponse['user']> = {},
): AuthResponse => ({
  user: {
    id: '1f0e6b8f-0000-4000-8000-000000000001',
    displayName: 'Ann',
    email: 'ann@example.com',
    providers: ['google'],
    createdAt: '2026-09-21T10:00:00.000Z',
    ...overrides,
  },
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-09-21T10:15:00.000Z',
});

const settle = () => new Promise((resolve) => setTimeout(resolve));

/** A Google Identity Services fake whose button "signs in" on demand. */
function fakeGoogle() {
  let signIn: ((response: { credential: string }) => void) | undefined;
  const accounts: GoogleAccountsId = {
    initialize: (config) => (signIn = config.callback),
    renderButton: () => undefined,
  };
  return {
    provider: {
      provide: GoogleIdentityServices,
      useValue: { load: () => Promise.resolve(accounts) },
    },
    signIn: (credential: string) => signIn?.({ credential }),
  };
}

async function renderSection(
  state: 'signed-out' | AuthResponse,
  extraProviders: unknown[] = [],
) {
  const view = await render(AccountSection, {
    providers: [...provideShellTesting(), ...(extraProviders as never[])],
  });
  const http = TestBed.inject(HttpTestingController);
  const restoring = TestBed.inject(AuthStore).restore();
  const refresh = http.expectOne(`${TEST_API_URL}/v1/auth/refresh`);
  if (state === 'signed-out')
    refresh.flush(null, { status: 401, statusText: 'Unauthorized' });
  else refresh.flush(state);
  await restoring;
  view.fixture.detectChanges();
  await settle();
  return { ...view, http };
}

describe('AccountSection', () => {
  it('says it is checking while the sign-in is restored', async () => {
    await render(AccountSection, { providers: provideShellTesting() });

    expect(screen.getByTestId('account').textContent).toContain(
      'Checking your sign-in',
    );
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('offers Google sign-in, and says honestly when Apple arrives', async () => {
    await renderSection('signed-out');

    expect(screen.getByTestId('google-button')).toBeTruthy();
    expect(screen.getByTestId('apple-unavailable').textContent).toContain(
      'Sign in with Apple arrives with the iPhone app.',
    );
  });

  it('signs in with the token Google returns', async () => {
    const google = fakeGoogle();
    const { http, fixture } = await renderSection('signed-out', [
      google.provider,
    ]);

    google.signIn('header.payload.signature');
    const request = http.expectOne(`${TEST_API_URL}/v1/auth/google`);
    expect(request.request.body).toMatchObject({
      idToken: 'header.payload.signature',
    });
    request.flush(signedIn());
    await settle();
    fixture.detectChanges();

    expect(screen.getByTestId('account-name').textContent).toContain('Ann');
    expect(screen.getByTestId('account').textContent).toContain(
      'Signed in with Google',
    );
  });

  it('explains a failed sign-in', async () => {
    const google = fakeGoogle();
    const { http, fixture } = await renderSection('signed-out', [
      google.provider,
    ]);

    google.signIn('header.payload.signature');
    http
      .expectOne(`${TEST_API_URL}/v1/auth/google`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();
    fixture.detectChanges();

    expect(screen.getByTestId('account-error').textContent).toContain(
      'Sign-in did not work.',
    );
  });

  it('shows the signed-in player and signs out', async () => {
    const { http, fixture } = await renderSection(signedIn());

    expect(screen.getByTestId('account-name').textContent).toContain('Ann');

    fireEvent.click(screen.getByTestId('sign-out'));
    http
      .expectOne(`${TEST_API_URL}/v1/auth/logout`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    fixture.detectChanges();

    expect(screen.getByTestId('google-button')).toBeTruthy();
  });

  it('deletes the account only after an explicit confirmation', async () => {
    const { http, fixture } = await renderSection(signedIn());

    fireEvent.click(screen.getByTestId('delete-account'));
    fixture.detectChanges();
    const confirmation = screen.getByRole('alertdialog');
    expect(confirmation.textContent).toContain('deleted permanently');
    http.expectNone(`${TEST_API_URL}/v1/me`);

    fireEvent.click(screen.getByTestId('cancel-delete'));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByTestId('delete-account'));
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId('confirm-delete'));
    await settle();
    const request = http.expectOne(`${TEST_API_URL}/v1/me`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();
    fixture.detectChanges();

    expect(screen.getByTestId('google-button')).toBeTruthy();
  });

  it('names a development account as such', async () => {
    await renderSection(
      signedIn({ displayName: null, email: null, providers: ['dev'] }),
    );

    expect(screen.getByTestId('account-name').textContent).toContain('Player');
    expect(screen.getByTestId('account').textContent).toContain(
      'a development account',
    );
  });
});
