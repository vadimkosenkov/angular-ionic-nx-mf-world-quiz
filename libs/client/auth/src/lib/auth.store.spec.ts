import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AUTH_CONFIG } from './auth.config';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';
import { API, session, USER } from './testing';

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AUTH_CONFIG, useValue: { apiUrl: API, googleClientId: 'g' } },
    ],
  });
  return {
    store: TestBed.inject(AuthStore),
    http: TestBed.inject(HttpTestingController),
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
});
