import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { AuthStore } from '@world-quiz/client/auth';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
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
    const { http, progress, fixture, auth } = await renderSection('offline');
    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));
    fixture.detectChanges();

    expect(screen.getByTestId('account-unverified').textContent).toContain(
      'cannot be reached',
    );
    expect(screen.getByTestId('sync-status').textContent).toContain(
      '1 result is waiting to be saved',
    );

    fireEvent.click(screen.getByTestId('retry-restore'));
    http.expectOne(`${TEST_API_URL}/v1/auth/refresh`).flush(signedIn());
    await settle();

    expect(auth.status()).toBe('signed-in');
  });

  it('shows the signed-in player and whether their results are saved', async () => {
    const { progress, fixture } = await renderSection(signedIn());

    expect(screen.getByTestId('account-name').textContent).toContain('Ann');
    expect(screen.getByTestId('account').textContent).toContain(
      'Signed in with Google',
    );
    expect(screen.getByTestId('sync-status').textContent).toContain(
      'All your results are saved to your account.',
    );

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
    expect(screen.getByTestId('account').textContent).not.toContain(
      'All your results are saved',
    );
  });

  it('saves what is left, signs out and deletes the data on this device', async () => {
    const { answer, emptyHistory, progress, auth } =
      await renderSection(signedIn());
    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));

    fireEvent.click(screen.getByTestId('sign-out'));
    await answer('POST', '/v1/sessions', (request) =>
      request.flush({}, { status: 201, statusText: 'Created' }),
    );
    await answer('GET', '/v1/sessions', emptyHistory);
    await answer('POST', '/v1/auth/logout', (request) =>
      request.flush(null, { status: 204, statusText: 'No Content' }),
    );

    expect(auth.status()).toBe('signed-out');
    expect(progress.owner()).toBeNull();
    expect(progress.pendingCount()).toBe(0);
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
    fireEvent.click(screen.getByTestId('cancel-sign-out'));
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
    const { http, answer, fixture, progress } = await renderSection(signedIn());
    await progress.claim(signedIn().user);

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
    await answer('DELETE', '/v1/me', (request) =>
      request.flush(null, { status: 204, statusText: 'No Content' }),
    );

    expect(progress.owner()).toBeNull();
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
