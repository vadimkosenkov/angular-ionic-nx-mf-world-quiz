import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AUTH_CONFIG } from './auth.config';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';
import { API, session } from './testing';

const flush = () => new Promise((resolve) => setTimeout(resolve));

async function signedInSetup(apiUrl: string = API) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AUTH_CONFIG, useValue: { apiUrl, googleClientId: null } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const store = TestBed.inject(AuthStore);
  const restored = store.restore();
  http.expectOne(`${apiUrl}/v1/auth/refresh`).flush(session('access-1'));
  await restored;
  return { http, store, client: TestBed.inject(HttpClient) };
}

describe('authInterceptor', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the access token to the API only', async () => {
    const { http, client } = await signedInSetup();

    void firstValueFrom(client.get(`${API}/v1/me`));
    void firstValueFrom(client.get('https://elsewhere.example/data'));
    void firstValueFrom(client.get(`${API}.evil.example/v1/me`));

    expect(
      http.expectOne(`${API}/v1/me`).request.headers.get('Authorization'),
    ).toBe('Bearer access-1');
    expect(
      http
        .expectOne('https://elsewhere.example/data')
        .request.headers.has('Authorization'),
    ).toBe(false);
    expect(
      http
        .expectOne(`${API}.evil.example/v1/me`)
        .request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('renews an expired access token once and retries the request', async () => {
    const { http, client } = await signedInSetup();

    const response = firstValueFrom(client.get(`${API}/v1/me`));
    http
      .expectOne(`${API}/v1/me`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API}/v1/auth/refresh`).flush(session('access-2'));
    await flush();
    const retry = http.expectOne(`${API}/v1/me`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-2');
    retry.flush({ ok: true });

    expect(await response).toEqual({ ok: true });
  });

  it('renews once for several requests that fail together', async () => {
    const { http, client } = await signedInSetup();

    const a = firstValueFrom(client.get(`${API}/v1/sessions/a`));
    const b = firstValueFrom(client.get(`${API}/v1/sessions/b`));
    http
      .expectOne(`${API}/v1/sessions/a`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne(`${API}/v1/sessions/b`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // Exactly one refresh request, although two requests need a new token.
    http.expectOne(`${API}/v1/auth/refresh`).flush(session('access-2'));
    await flush();
    http.expectOne(`${API}/v1/sessions/a`).flush({ id: 'a' });
    http.expectOne(`${API}/v1/sessions/b`).flush({ id: 'b' });

    expect(await Promise.all([a, b])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('gives up and signs out when the refresh is refused', async () => {
    const { http, client, store } = await signedInSetup();

    const response = firstValueFrom(client.get(`${API}/v1/me`));
    http
      .expectOne(`${API}/v1/me`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    http
      .expectOne(`${API}/v1/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(response).rejects.toMatchObject({ status: 401 });
    expect(store.status()).toBe('signed-out');
  });

  // A deployment can proxy `/v1` under the app's own origin, so that the
  // sign-in cookie is first-party. The API URL is then empty, and the token
  // must still go to the API — and only to it.
  describe("with the API under the app's own origin", () => {
    it('sends the token to /v1 and to nothing else', async () => {
      const { http, client, store } = await signedInSetup('');

      client.get('/v1/sessions').subscribe();
      expect(
        http.expectOne('/v1/sessions').request.headers.get('Authorization'),
      ).toBe(`Bearer ${store.currentAccessToken()}`);

      client.get('/assets/data.json').subscribe();
      expect(
        http
          .expectOne('/assets/data.json')
          .request.headers.has('Authorization'),
      ).toBe(false);
      http.verify();
    });
  });
});
