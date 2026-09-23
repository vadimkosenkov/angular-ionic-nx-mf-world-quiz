import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AUTH_CONFIG } from './auth.config';
import { authInterceptor } from './auth.interceptor';
import { provideAuth } from './auth.providers';
import { AuthStore, REFRESH_LOCK } from './auth.store';
import {
  REFRESH_TOKEN_STORE,
  type RefreshTokenStore,
} from './refresh-token-store';
import { API, session, USER } from './testing';

/** The iPhone app's store: the token comes in the body and is kept here. */
function memoryRefreshTokenStore(initial: string | null = null) {
  let token = initial;
  const store: RefreshTokenStore = {
    delivery: 'body',
    read: () => Promise.resolve(token),
    save: (value) => {
      token = value;
      return Promise.resolve();
    },
    clear: () => {
      token = null;
      return Promise.resolve();
    },
  };
  return { store, stored: () => token };
}

function setup(refreshTokens?: RefreshTokenStore) {
  const reported: unknown[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AUTH_CONFIG, useValue: { apiUrl: API, googleClientId: 'g' } },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => reported.push(error) },
      },
      ...(refreshTokens
        ? [{ provide: REFRESH_TOKEN_STORE, useValue: refreshTokens }]
        : []),
    ],
  });
  return {
    store: TestBed.inject(AuthStore),
    http: TestBed.inject(HttpTestingController),
    reported,
  };
}

/** Lets pending promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('AuthStore', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('restores a previous sign-in with the refresh cookie', async () => {
    const { store, http } = setup();
    expect(store.status()).toBe('restoring');

    const restored = store.restore();
    const request = http.expectOne(`${API}/v1/auth/refresh`);
    expect(request.request.withCredentials).toBe(true);
    request.flush(session());
    await restored;

    expect(store.status()).toBe('signed-in');
    expect(store.user()).toEqual(USER);
    expect(store.currentAccessToken()).toBe('access-1');
  });

  it('lets callers wait for the outcome of the restore', async () => {
    const { store, http } = setup();
    void store.restore();
    let settled = false;
    void store.whenRestored().then(() => (settled = true));

    await flush();
    expect(settled).toBe(false);
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());
    await store.whenRestored();

    expect(store.status()).toBe('signed-in');
  });

  it('starts signed out when there is no valid refresh cookie', async () => {
    const { store, http } = setup();

    const restored = store.restore();
    http
      .expectOne(`${API}/v1/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await restored;

    expect(store.status()).toBe('signed-out');
    expect(store.currentAccessToken()).toBeNull();
  });

  it('keeps an unreachable sign-in unverified, not signed out, and checks again', async () => {
    const { store, http } = setup();

    const offline = store.restore();
    http.expectOne(`${API}/v1/auth/refresh`).error(new ProgressEvent('error'));
    await offline;
    expect(store.status()).toBe('unverified');

    const online = store.restore();
    expect(store.status()).toBe('restoring');
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());
    await online;
    expect(store.status()).toBe('signed-in');
  });

  it('stays signed in when a refresh gets no answer, and signs out when refused', async () => {
    const { store, http } = setup();
    const restored = store.restore();
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());
    await restored;

    const offline = store.refreshAccessToken();
    http.expectOne(`${API}/v1/auth/refresh`).error(new ProgressEvent('error'));
    expect(await offline).toBe(false);
    expect(store.status()).toBe('signed-in');
    expect(store.user()).toEqual(USER);

    const refused = store.refreshAccessToken();
    http
      .expectOne(`${API}/v1/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await refused).toBe(false);
    expect(store.status()).toBe('signed-out');
  });

  it.each([
    [503, 'Service Unavailable'],
    [429, 'Too Many Requests'],
  ])(
    'does not take a %i for a refusal: restoring stays unverified, a session stays signed in',
    async (status, statusText) => {
      const { store, http, reported } = setup();

      const restoring = store.restore();
      http
        .expectOne(`${API}/v1/auth/refresh`)
        .flush(null, { status, statusText });
      await restoring;
      expect(store.status()).toBe('unverified');

      const retried = store.restore();
      http.expectOne(`${API}/v1/auth/refresh`).flush(session());
      await retried;

      const refreshing = store.refreshAccessToken();
      http
        .expectOne(`${API}/v1/auth/refresh`)
        .flush(null, { status, statusText });
      expect(await refreshing).toBe(false);
      expect(store.status()).toBe('signed-in');
      expect(reported).toEqual([]);
    },
  );

  it('reports a response that breaks the contract instead of signing out', async () => {
    const { store, http, reported } = setup();

    const restoring = store.restore();
    http.expectOne(`${API}/v1/auth/refresh`).flush({ unexpected: true });
    await restoring;

    expect(store.status()).toBe('unverified');
    expect(reported).toHaveLength(1);
  });

  it('checks an unverified sign-in again when the browser comes back online', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideAuth({ apiUrl: API, googleClientId: 'g' }),
      ],
    });
    const store = TestBed.inject(AuthStore);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API}/v1/auth/refresh`).error(new ProgressEvent('error'));
    await flush();
    expect(store.status()).toBe('unverified');

    window.dispatchEvent(new Event('online'));
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());
    await flush();

    expect(store.status()).toBe('signed-in');
  });

  it('refreshes under a Web Lock, so that tabs take turns', async () => {
    const names: string[] = [];
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: (name: string, task: () => Promise<unknown>) => {
          names.push(name);
          return task();
        },
      },
    });
    try {
      const { store, http } = setup();

      const refreshed = store.refreshAccessToken();
      http.expectOne(`${API}/v1/auth/refresh`).flush(session());

      expect(await refreshed).toBe(true);
      expect(names).toEqual([REFRESH_LOCK]);
    } finally {
      Reflect.deleteProperty(navigator, 'locks');
    }
  });

  it('shares one refresh request between concurrent callers', async () => {
    const { store, http } = setup();

    const first = store.refreshAccessToken();
    const second = store.refreshAccessToken();
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());

    expect(await Promise.all([first, second])).toEqual([true, true]);
  });

  it('signs in with a provider token and keeps the access token in memory only', async () => {
    const { store, http } = setup();

    const signingIn = store.signIn('google', 'id.token.value', 'nonce-123');
    expect(store.busy()).toBe(true);
    const request = http.expectOne(`${API}/v1/auth/google`);
    expect(request.request.body).toEqual({
      idToken: 'id.token.value',
      nonce: 'nonce-123',
      refreshTokenIn: 'cookie',
    });
    request.flush(session('access-2'));

    expect(await signingIn).toBe(true);
    expect(store.signedIn()).toBe(true);
    expect(store.busy()).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('reports a refused sign-in and an unreachable API differently', async () => {
    const { store, http } = setup();

    const refused = store.signIn('google', 'a.b.c', 'nonce-123');
    http
      .expectOne(`${API}/v1/auth/google`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(await refused).toBe(false);
    expect(store.error()).toBe('sign-in-failed');

    const offline = store.signIn('google', 'a.b.c', 'nonce-123');
    http.expectOne(`${API}/v1/auth/google`).error(new ProgressEvent('error'));
    expect(await offline).toBe(false);
    expect(store.error()).toBe('unreachable');
  });

  it('signs out locally even when the API cannot be reached', async () => {
    const { store, http } = setup();
    const restored = store.restore();
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());
    await restored;

    const out = store.signOut();
    http.expectOne(`${API}/v1/auth/logout`).error(new ProgressEvent('error'));
    await out;

    expect(store.status()).toBe('signed-out');
    expect(store.currentAccessToken()).toBeNull();
  });

  it('deletes the account with the access token and ends the session', async () => {
    const { store, http } = setup();
    const restored = store.restore();
    http.expectOne(`${API}/v1/auth/refresh`).flush(session('access-9'));
    await restored;

    const deleting = store.deleteAccount();
    await flush();
    const request = http.expectOne(`${API}/v1/me`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer access-9',
    );
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(await deleting).toBe(true);
    expect(store.status()).toBe('signed-out');
  });

  it('changes the nickname, and says why when the API refuses it', async () => {
    const { store, http } = setup();
    const restored = store.restore();
    http.expectOne(`${API}/v1/auth/refresh`).flush(session());
    await restored;

    const saved = store.setNickname('Globe Trotter');
    await flush();
    const request = http.expectOne(`${API}/v1/me`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ nickname: 'Globe Trotter' });
    request.flush({ ...USER, nickname: 'Globe Trotter' });
    expect(await saved).toBe(true);
    expect(store.user()?.nickname).toBe('Globe Trotter');

    const refused = store.setNickname('<b>');
    await flush();
    http
      .expectOne(`${API}/v1/me`)
      .flush(null, { status: 400, statusText: 'Bad Request' });
    expect(await refused).toBe(false);
    expect(store.error()).toBe('nickname-invalid');
    expect(store.user()?.nickname).toBe('Globe Trotter');
  });

  // In the app there is no cookie: the API returns the refresh token in the
  // body and the app keeps it in the Keychain (docs/deployment/ios.md).
  describe('in the iPhone app', () => {
    it('stores the rotated refresh token and sends it back', async () => {
      const keychain = memoryRefreshTokenStore('stored-token');
      const { store, http } = setup(keychain.store);

      const restored = store.restore();
      // Unlike the web, the app reads the Keychain first, so the request
      // leaves one microtask later.
      await flush();
      const request = http.expectOne(`${API}/v1/auth/refresh`);
      expect(request.request.body).toEqual({
        refreshTokenIn: 'body',
        refreshToken: 'stored-token',
      });
      request.flush({ ...session(), refreshToken: 'rotated-token' });
      await restored;
      await flush();

      expect(store.status()).toBe('signed-in');
      // The API retires a token when it is used; keeping the old one would
      // sign the player out on the next start.
      expect(keychain.stored()).toBe('rotated-token');
    });

    it('does not ask the API when no token is stored', async () => {
      const keychain = memoryRefreshTokenStore();
      const { store, http } = setup(keychain.store);

      await store.restore();

      http.expectNone(`${API}/v1/auth/refresh`);
      expect(store.status()).toBe('signed-out');
    });

    // The token is read when the refresh runs, not before it: the app can
    // bootstrap twice, and a second instance presenting the token the first
    // one already used looks like theft to the API.
    it('sends the token the previous refresh rotated, not the old one', async () => {
      const keychain = memoryRefreshTokenStore('token-1');
      const { store, http } = setup(keychain.store);
      const first = store.restore();
      await flush();
      http
        .expectOne(`${API}/v1/auth/refresh`)
        .flush({ ...session(), refreshToken: 'token-2' });
      await first;
      await flush();

      const again = store.refreshAccessToken();
      await flush();
      const second = http.expectOne(`${API}/v1/auth/refresh`);
      expect(second.request.body).toEqual({
        refreshTokenIn: 'body',
        refreshToken: 'token-2',
      });
      second.flush({ ...session(), refreshToken: 'token-3' });
      await again;
      await flush();
    });

    it('forgets the token when the player signs out', async () => {
      const keychain = memoryRefreshTokenStore('stored-token');
      const { store, http } = setup(keychain.store);
      const restored = store.restore();
      await flush();
      http
        .expectOne(`${API}/v1/auth/refresh`)
        .flush({ ...session(), refreshToken: 'rotated-token' });
      await restored;

      const signedOut = store.signOut();
      await flush();
      http.expectOne(`${API}/v1/auth/logout`).flush({});
      await signedOut;
      await flush();

      expect(keychain.stored()).toBeNull();
    });
  });
});
