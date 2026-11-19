import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import { APP_URL } from '@world-quiz/client/quiz-ports';
import { AuthStore } from '@world-quiz/client/auth';
import { Toasts } from '@world-quiz/client/ui';
import type { AuthResponse, Friends } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { FriendsPage } from './friends.page';

const settle = () => new Promise((resolve) => setTimeout(resolve));

const SESSION: AuthResponse = {
  user: {
    id: '1f0e6b8f-0000-4000-8000-000000000001',
    displayName: 'Ann',
    nickname: 'Ann the Explorer',
    email: 'ann@example.com',
    providers: ['google'],
    inviteCode: 'ANN12345',
    createdAt: '2026-09-21T10:00:00.000Z',
  },
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-09-21T10:15:00.000Z',
};

const BORIS = {
  id: '2f0e6b8f-0000-4000-8000-000000000002',
  nickname: 'Boris',
  since: '2026-11-10T10:00:00.000Z',
};
const CLARA = {
  id: '3f0e6b8f-0000-4000-8000-000000000003',
  nickname: 'Clara',
  since: '2026-11-17T10:00:00.000Z',
};
const DMITRI = {
  id: '4f0e6b8f-0000-4000-8000-000000000004',
  nickname: 'Dmitri',
  since: '2026-11-18T10:00:00.000Z',
};

const EMPTY: Friends = { friends: [], incoming: [], outgoing: [] };

async function renderPage(lists: Friends | 'error' = EMPTY) {
  const forward: string[] = [];
  const view = await render(FriendsPage, {
    providers: [
      ...provideShellTesting(),
      { provide: APP_URL, useValue: 'https://play.example.test' },
      {
        provide: NavController,
        useValue: { navigateForward: (url: string) => forward.push(url) },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);

  /** Answers the next request matching `url`, once it has been sent. */
  const answer = async (
    method: string,
    url: string,
    respond: (request: TestRequest) => void,
  ) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const [found] = http.match({ method, url: `${TEST_API_URL}${url}` });
      if (found) {
        respond(found);
        await settle();
        view.fixture.detectChanges();
        return;
      }
      await settle();
      view.fixture.detectChanges();
    }
    throw new Error(`${method} ${url} was not sent`);
  };

  const restoring = TestBed.inject(AuthStore).restore();
  await answer('POST', '/v1/auth/refresh', (request) => request.flush(SESSION));
  await restoring;
  await answer('GET', '/v1/friends', (request) =>
    lists === 'error'
      ? request.error(new ProgressEvent('error'))
      : request.flush(lists),
  );

  return { ...view, http, answer, forward, toasts: TestBed.inject(Toasts) };
}

const rowsOf = (testId: string) =>
  within(screen.getByTestId(testId))
    .getAllByRole('listitem')
    .map((row) => row.textContent?.replace(/\s+/g, ' ').trim());

describe('FriendsPage', () => {
  it('says what the invite is for while there is nobody at all', async () => {
    await renderPage();

    expect(screen.getByTestId('friends-empty').textContent).toContain(
      'Nobody here yet',
    );
    expect(screen.queryByTestId('friend-list')).toBeNull();
    // Nothing is shown until the invite is asked for.
    expect(screen.queryByTestId('invite-dialog')).toBeNull();
  });

  it('opens the invite from the corner of the header', async () => {
    const { fixture } = await renderPage();

    fireEvent.click(screen.getByTestId('friends-invite'));
    fixture.detectChanges();

    expect(screen.getByTestId('invite-code').textContent).toContain(
      'ANN1 2345',
    );
  });

  it('lists who is waiting, who is a friend and who was asked', async () => {
    await renderPage({
      friends: [BORIS],
      incoming: [CLARA],
      outgoing: [DMITRI],
    });

    expect(rowsOf('friend-requests')).toEqual([
      'C Clara wants to be friends Accept',
    ]);
    expect(rowsOf('friend-list')).toEqual([
      'B Boris friends since Nov 10, 2026',
    ]);
    expect(rowsOf('friend-sent')).toEqual(['D Dmitri asked on Nov 18, 2026']);
    expect(screen.queryByTestId('friends-empty')).toBeNull();
  });

  it('accepts a request, says so, and takes the new list from the server', async () => {
    const { answer, toasts } = await renderPage({
      friends: [],
      incoming: [CLARA],
      outgoing: [],
    });

    fireEvent.click(screen.getByTestId(`friend-accept-${CLARA.id}`));
    await answer('POST', `/v1/friends/${CLARA.id}/accept`, (request) =>
      request.flush(null),
    );
    await answer('GET', '/v1/friends', (request) =>
      request.flush({ friends: [CLARA], incoming: [], outgoing: [] }),
    );

    expect(toasts.current()?.text).toBe('You and Clara are friends now.');
    expect(screen.queryByTestId('friend-requests')).toBeNull();
    expect(rowsOf('friend-list')).toEqual([
      'C Clara friends since Nov 17, 2026',
    ]);
  });

  it('says so when an answer could not be sent', async () => {
    const { answer, toasts } = await renderPage({
      friends: [],
      incoming: [CLARA],
      outgoing: [],
    });

    fireEvent.click(screen.getByTestId(`friend-decline-${CLARA.id}`));
    await answer('DELETE', `/v1/friends/${CLARA.id}`, (request) =>
      request.error(new ProgressEvent('error')),
    );

    expect(toasts.current()?.text).toBe('That did not work. Try again.');
    // The request is still there: the server never said it was gone.
    expect(screen.getByTestId('friend-requests')).toBeTruthy();
  });

  it('opens a friend page from their row', async () => {
    const { forward } = await renderPage({
      friends: [BORIS],
      incoming: [],
      outgoing: [],
    });

    fireEvent.click(screen.getByTestId(`friend-${BORIS.id}`));

    expect(forward).toEqual([`/friends/${BORIS.id}`]);
  });

  it('offers to try again when the lists cannot be loaded', async () => {
    const { answer } = await renderPage('error');

    expect(screen.getByTestId('friends-retry')).toBeTruthy();
    // An error is not an empty list: nothing is claimed about who is there.
    expect(screen.queryByTestId('friends-empty')).toBeNull();

    fireEvent.click(screen.getByTestId('friends-retry'));
    await answer('GET', '/v1/friends', (request) =>
      request.flush({ friends: [BORIS], incoming: [], outgoing: [] }),
    );

    expect(rowsOf('friend-list')).toEqual([
      'B Boris friends since Nov 10, 2026',
    ]);
  });
});
