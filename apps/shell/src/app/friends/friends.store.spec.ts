import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthStore } from '@world-quiz/client/auth';
import { KEY_VALUE_STORAGE } from '@world-quiz/client/settings';
import { Toasts } from '@world-quiz/client/ui';
import type { AuthResponse, Friends } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { FriendsStore, PENDING_INVITE_STORAGE_KEY } from './friends.store';

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

const FRIEND = {
  id: '2f0e6b8f-0000-4000-8000-000000000002',
  nickname: 'Boris',
  since: '2026-11-18T10:00:00.000Z',
};

const LISTS: Friends = { friends: [FRIEND], incoming: [], outgoing: [] };

async function setup({
  signedIn = true,
  stored,
}: { signedIn?: boolean; stored?: Readonly<Record<string, string>> } = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: provideShellTesting({ storage: stored }),
  });
  const http = TestBed.inject(HttpTestingController);
  const store = TestBed.inject(FriendsStore);
  const toasts = TestBed.inject(Toasts);

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
        TestBed.tick();
        return;
      }
      await settle();
      TestBed.tick();
    }
    throw new Error(`${method} ${url} was not sent`);
  };

  if (signedIn) {
    const restoring = TestBed.inject(AuthStore).restore();
    await answer('POST', '/v1/auth/refresh', (request) =>
      request.flush(SESSION),
    );
    await restoring;
    TestBed.tick();
  }
  return { store, http, toasts, answer };
}

describe('FriendsStore', () => {
  it('asks for nothing while nobody is signed in', async () => {
    const { store, http } = await setup({ signedIn: false });
    TestBed.tick();
    await settle();

    expect(store.friends()).toEqual([]);
    expect(store.inviteCode()).toBeNull();
    expect(http.match(`${TEST_API_URL}/v1/friends`)).toEqual([]);
  });

  it('loads the three lists as soon as there is somebody to load them for', async () => {
    const { store, answer } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    expect(store.friends()).toEqual([FRIEND]);
    expect(store.inviteCode()).toBe('ANN12345');
  });

  it('refuses the player own code without asking the API', async () => {
    const { store, answer, http } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    // Typed the way a player would read it off their own screen.
    const outcome = await store.request('ann 12345');

    expect(outcome).toEqual({ ok: false, error: 'self' });
    expect(
      http.match({
        method: 'POST',
        url: `${TEST_API_URL}/v1/friends/requests`,
      }),
    ).toEqual([]);
  });

  it('refuses something that is not a code at all', async () => {
    const { store, answer } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    expect(await store.request('nope')).toEqual({
      ok: false,
      error: 'invalid-code',
    });
  });

  it('sends a request, normalised, and reloads the lists', async () => {
    const { store, answer } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    const sending = store.request('b0b-12345');
    await answer('POST', '/v1/friends/requests', (request) => {
      // `I`/`L` read as one and `O` as zero, upper case, no separators.
      expect(request.request.body).toEqual({ code: 'B0B12345' });
      request.flush({ status: 'requested', friend: FRIEND });
    });

    expect(await sending).toEqual({
      ok: true,
      value: { status: 'requested', friend: FRIEND },
    });
    // The three lists move together, so the server is asked again.
    await answer('GET', '/v1/friends', (request) =>
      request.flush({ ...LISTS, outgoing: [FRIEND] }),
    );
    expect(store.outgoing()).toEqual([FRIEND]);
  });

  it('says a code nobody holds apart from a request that failed', async () => {
    const { store, answer } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    const unknown = store.request('B0B12345');
    await answer('POST', '/v1/friends/requests', (request) =>
      request.flush(null, { status: 404, statusText: 'Not Found' }),
    );
    expect(await unknown).toEqual({ ok: false, error: 'unknown-code' });

    const failed = store.request('B0B12345');
    await answer('POST', '/v1/friends/requests', (request) =>
      request.error(new ProgressEvent('error')),
    );
    expect(await failed).toEqual({ ok: false, error: 'failed' });
  });

  it('accepts and removes through the ids the lists carry', async () => {
    const { store, answer } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    const accepting = store.accept(FRIEND.id);
    await answer('POST', `/v1/friends/${FRIEND.id}/accept`, (request) =>
      request.flush(null),
    );
    expect(await accepting).toBe(true);
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    const removing = store.remove(FRIEND.id);
    await answer('DELETE', `/v1/friends/${FRIEND.id}`, (request) =>
      request.error(new ProgressEvent('error')),
    );
    expect(await removing).toBe(false);
  });

  it('sends an invite remembered before there was an account, once', async () => {
    // What an invite link leaves behind: the code waits in the device's own
    // storage until somebody signs in.
    const { answer, toasts } = await setup({
      stored: { [PENDING_INVITE_STORAGE_KEY]: 'B0B12345' },
    });
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));
    await answer('POST', '/v1/friends/requests', (request) => {
      expect(request.request.body).toEqual({ code: 'B0B12345' });
      request.flush({ status: 'accepted', friend: FRIEND });
    });
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    expect(toasts.current()?.text).toBe('You and Boris are friends now.');
    // Forgotten whatever came of it: a code that cannot be used must not be
    // retried on every start.
    const storage = TestBed.inject(KEY_VALUE_STORAGE);
    expect(await storage.get(PENDING_INVITE_STORAGE_KEY)).toBeNull();
  });

  it('sends an invite at once when the link was opened by a player already signed in', async () => {
    // The effect that waits for an account has long since run and found
    // nothing: writing the code down is what sends it in this order.
    const { store, answer, toasts } = await setup();
    await answer('GET', '/v1/friends', (request) => request.flush(LISTS));

    // Writing the code down starts the request but does not wait for it.
    await store.rememberInvite('B0B12345');
    await answer('POST', '/v1/friends/requests', (request) => {
      expect(request.request.body).toEqual({ code: 'B0B12345' });
      request.flush({ status: 'requested', friend: FRIEND });
    });

    expect(toasts.current()?.text).toBe('Asked Boris to be friends.');
    const storage = TestBed.inject(KEY_VALUE_STORAGE);
    expect(await storage.get(PENDING_INVITE_STORAGE_KEY)).toBeNull();
  });

  it('writes down an invite for whoever signs in next', async () => {
    const { store } = await setup({ signedIn: false });
    await store.rememberInvite('B0B12345');

    const storage = TestBed.inject(KEY_VALUE_STORAGE);
    expect(await storage.get(PENDING_INVITE_STORAGE_KEY)).toBe('B0B12345');
  });
});
