import { vi } from 'vitest';
import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { AuthStore } from '@world-quiz/client/auth';
import { ProgressStore } from '@world-quiz/client/progress';
import {
  finishedSession,
  sessionResult,
} from '@world-quiz/client/progress/testing';
import { Toasts } from '@world-quiz/client/ui';
import type { AuthResponse } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { AccountSection } from './account-section';

const signedIn = (
  overrides: Partial<AuthResponse['user']> = {},
): AuthResponse => ({
  user: {
    id: '1f0e6b8f-0000-4000-8000-000000000001',
    displayName: 'Ann',
    nickname: 'Ann the Explorer',
    email: 'ann@example.com',
    providers: ['google'],
    createdAt: '2026-09-21T10:00:00.000Z',
    ...overrides,
  },
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-09-21T10:15:00.000Z',
});

const settle = () => new Promise((resolve) => setTimeout(resolve));

/**
 * Deleting the account is held, not pressed (`wq-hold-button`): the press
 * starts it, and nothing happens until the hold has lasted. The clock is
 * faked so the test does not really wait for it, while everything else —
 * the HTTP mock, the microtasks — keeps running on real time.
 */
async function holdToDelete(fixture: { detectChanges(): void }): Promise<void> {
  const button = screen
    .getByTestId('confirm-delete')
    .querySelector('button') as HTMLElement;
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    fireEvent.pointerDown(button);
    await vi.advanceTimersByTimeAsync(2_000);
  } finally {
    vi.useRealTimers();
  }
  fixture.detectChanges();
}

/** The way out of a dialog: the round button in its corner. */
function closeButtonOf(dialog: string): HTMLElement {
  const close = screen
    .getByTestId(dialog)
    .querySelector<HTMLElement>('[data-testid="dialog-close"]');
  if (!close) {
    throw new Error(`${dialog} has no close button`);
  }
  return close;
}

async function renderSection(state: 'offline' | AuthResponse) {
  const view = await render(AccountSection, {
    providers: provideShellTesting(),
  });
  const http = TestBed.inject(HttpTestingController);
  const restoring = TestBed.inject(AuthStore).restore();
  const refresh = http.expectOne(`${TEST_API_URL}/v1/auth/refresh`);
  if (state === 'offline') refresh.error(new ProgressEvent('error'));
  else refresh.flush(state);
  await restoring;
  await view.fixture.whenStable();

  /** Answers the next request matching `url` once it has been sent. */
  const answer = async (
    method: string,
    url: string,
    respond: (request: TestRequest) => void,
  ) => {
    for (let i = 0; i < 20; i++) {
      const [found] = http.match({ method, url: `${TEST_API_URL}${url}` });
      if (found) {
        respond(found);
        await settle();
        await view.fixture.whenStable();
        return;
      }
      await settle();
    }
    throw new Error(`${method} ${url} was not sent`);
  };
  const emptyHistory = (request: TestRequest) =>
    request.flush({ sessions: [], cursor: null, hasMore: false });

  return {
    ...view,
    http,
    answer,
    emptyHistory,
    progress: TestBed.inject(ProgressStore),
    auth: TestBed.inject(AuthStore),
    toasts: TestBed.inject(Toasts),
  };
}

describe('AccountSection', () => {
  it('says it is checking while the sign-in is restored', async () => {
    await render(AccountSection, { providers: provideShellTesting() });

    expect(screen.getByTestId('account').textContent).toContain(
      'Checking your sign-in',
    );
    TestBed.inject(HttpTestingController).match(() => true);
  });

  it('keeps an unreachable sign-in, says so, counts unsent results and retries', async () => {
    const { http, progress, fixture, auth, toasts } =
      await renderSection('offline');
    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));
    fixture.detectChanges();

    expect(screen.getByTestId('account-unverified').textContent).toContain(
      'cannot be reached',
    );
    expect(screen.getByTestId('sync-status').textContent).toContain(
      '1 result is waiting to be saved',
    );

    // A retry that fails again changes nothing on screen, so it is said.
    fireEvent.click(screen.getByTestId('retry-restore'));
    http
      .expectOne(`${TEST_API_URL}/v1/auth/refresh`)
      .error(new ProgressEvent('error'));
    await settle();
    fixture.detectChanges();

    expect(auth.status()).toBe('unverified');
    expect(toasts.current()).toMatchObject({ tone: 'error' });
    expect(toasts.current()?.text).toContain('cannot be reached');

    fireEvent.click(screen.getByTestId('retry-restore'));
    http.expectOne(`${TEST_API_URL}/v1/auth/refresh`).flush(signedIn());
    await settle();

    expect(auth.status()).toBe('signed-in');
  });

  it('shows the signed-in player, and says only what is still waiting', async () => {
    const { progress, fixture } = await renderSection(signedIn());

    expect(screen.getByTestId('account-name').textContent).toContain('Ann');
    expect(screen.getByTestId('account').textContent).toContain(
      'Signed in with Google',
    );
    // Everything saved is the normal state, so the card says nothing.
    expect(screen.queryByTestId('sync-status')).toBeNull();

    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));
    progress.recordSession(finishedSession([{ code: 'de', correct: true }]));
    fixture.detectChanges();

    expect(screen.getByTestId('sync-status').textContent).toContain(
      '2 results are waiting to be saved',
    );
  });

  it('says honestly when the server refused a result', async () => {
    const { progress, fixture } = await renderSection(signedIn());
    const played = progress.recordSession(
      finishedSession([{ code: 'fr', correct: true }]),
    );

    progress.markRejected([played.id]);
    fixture.detectChanges();

    expect(screen.getByTestId('sync-rejected').textContent).toContain(
      '1 result could not be verified by the server',
    );
    // A refused result is not "waiting": it has its own row and nothing is
    // on its way to the account.
    expect(screen.queryByTestId('sync-status')).toBeNull();
  });

  it('saves what is left, asks, then signs out and deletes the data on this device', async () => {
    const { answer, emptyHistory, progress, auth, toasts } =
      await renderSection(signedIn());
    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));

    fireEvent.click(screen.getByTestId('sign-out'));
    await answer('POST', '/v1/sessions', (request) =>
      request.flush(sessionResult(request.request.body.id), {
        status: 201,
        statusText: 'Created',
      }),
    );
    await answer('GET', '/v1/sessions', emptyHistory);

    // Signing out is asked about even when everything is saved: it deletes
    // this account's results from the device, and the row sits a finger
    // away from the rest of Settings.
    expect(screen.getByTestId('sign-out-confirmation').textContent).toContain(
      'Sign out?',
    );
    expect(auth.status()).toBe('signed-in');

    fireEvent.click(screen.getByTestId('confirm-sign-out'));
    await answer('POST', '/v1/auth/logout', (request) =>
      request.flush(null, { status: 204, statusText: 'No Content' }),
    );

    expect(auth.status()).toBe('signed-out');
    expect(progress.owner()).toBeNull();
    expect(progress.pendingCount()).toBe(0);
    // Said on the welcome screen the app leaves for.
    expect(toasts.current()?.text).toBe('You are signed out.');
  });

  it('asks before signing out when results could not be saved, and deletes them only then', async () => {
    const { answer, progress, auth } = await renderSection(signedIn());
    progress.recordSession(finishedSession([{ code: 'fr', correct: false }]));

    fireEvent.click(screen.getByTestId('sign-out'));
    await answer('POST', '/v1/sessions', (request) =>
      request.error(new ProgressEvent('error')),
    );

    const confirmation = screen.getByRole('alertdialog');
    expect(confirmation.textContent).toContain(
      '1 result played on this device has not been saved to your account yet.',
    );
    fireEvent.click(closeButtonOf('sign-out-confirmation'));
    expect(auth.status()).toBe('signed-in');
    expect(progress.mistakeCount()).toBe(1);

    fireEvent.click(screen.getByTestId('sign-out'));
    await answer('POST', '/v1/sessions', (request) =>
      request.error(new ProgressEvent('error')),
    );
    fireEvent.click(screen.getByTestId('confirm-sign-out'));
    await answer('POST', '/v1/auth/logout', (request) =>
      request.flush(null, { status: 204, statusText: 'No Content' }),
    );

    expect(auth.status()).toBe('signed-out');
    expect(progress.mistakeCount()).toBe(0);
  });

  it('deletes the account only after an explicit confirmation, then the data on this device', async () => {
    const { http, answer, fixture, progress, toasts } =
      await renderSection(signedIn());
    await progress.claim(signedIn().user);

    fireEvent.click(screen.getByTestId('delete-account'));
    fixture.detectChanges();
    const confirmation = screen.getByRole('alertdialog');
    expect(confirmation.textContent).toContain('deleted permanently');
    http.expectNone(`${TEST_API_URL}/v1/me`);

    fireEvent.click(closeButtonOf('delete-confirmation'));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByTestId('delete-account'));
    fixture.detectChanges();
    await holdToDelete(fixture);
    await answer('DELETE', '/v1/me', (request) =>
      request.flush(null, { status: 204, statusText: 'No Content' }),
    );

    expect(progress.owner()).toBeNull();
    expect(toasts.current()?.text).toBe(
      'Your account and its results are deleted.',
    );
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

  it('shows the public name and changes it within the rules', async () => {
    const { answer, fixture, auth, toasts } = await renderSection(signedIn());
    expect(screen.getByTestId('account-nickname').textContent).toContain(
      'Ann the Explorer',
    );

    fireEvent.click(screen.getByTestId('nickname-edit'));
    fixture.detectChanges();
    const type = (value: string) => {
      screen
        .getByTestId('nickname-input')
        .dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
      fixture.detectChanges();
    };
    const save = () =>
      screen.getByTestId('nickname-save') as HTMLElement & {
        disabled: boolean;
      };

    type('<b>');
    expect(save().disabled).toBe(true);
    type('Globe Trotter');
    expect(save().disabled).toBe(false);
    fireEvent.submit(screen.getByTestId('nickname-input').closest('form')!);
    await answer('PATCH', '/v1/me', (request) => {
      expect(request.request.body).toEqual({ nickname: 'Globe Trotter' });
      request.flush({ ...signedIn().user, nickname: 'Globe Trotter' });
    });

    expect(auth.user()?.nickname).toBe('Globe Trotter');
    expect(screen.getByTestId('account-nickname').textContent).toContain(
      'Globe Trotter',
    );
    expect(toasts.current()).toMatchObject({
      tone: 'success',
      text: 'Your public name is saved.',
    });
  });

  it('explains when the server refuses a name', async () => {
    const { answer, fixture, toasts } = await renderSection(signedIn());
    fireEvent.click(screen.getByTestId('nickname-edit'));
    fixture.detectChanges();
    screen
      .getByTestId('nickname-input')
      .dispatchEvent(
        new CustomEvent('ionInput', { detail: { value: 'Valid Name' } }),
      );
    fixture.detectChanges();

    fireEvent.submit(screen.getByTestId('nickname-input').closest('form')!);
    await answer('PATCH', '/v1/me', (request) =>
      request.flush(null, { status: 400, statusText: 'Bad Request' }),
    );

    expect(toasts.current()).toMatchObject({ tone: 'error' });
    expect(toasts.current()?.text).toContain('This name is not allowed');
    // The form stays open, with the rules under the field it is about.
    expect(screen.getByTestId('nickname-input')).toBeTruthy();
  });
});
