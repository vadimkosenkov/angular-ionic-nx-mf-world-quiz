import {
  HttpErrorResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AUTH_CONFIG } from './auth.config';
import { AuthStore } from './auth.store';

/**
 * Sends the access token to the World Quiz API, and renews it once when the
 * API answers 401 (the token expired after 15 minutes), then retries.
 *
 * Other hosts never see the token, and `/v1/auth` requests are left alone:
 * they authenticate with the provider's ID token or the refresh cookie.
 *
 * An empty `apiUrl` means the API is reached under this app's own origin
 * (a deployment proxies `/v1` to it, so the sign-in cookie is first-party).
 * The match is then on `/v1/`, not on every relative request: an asset
 * fetched with `HttpClient` must not carry the token.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const { apiUrl } = inject(AUTH_CONFIG);
  const store = inject(AuthStore);

  const api = `${apiUrl}/v1/`;
  if (!request.url.startsWith(api) || request.url.startsWith(`${api}auth/`)) {
    return next(request);
  }

  const authorized = (original: HttpRequest<unknown>) => {
    const token = store.currentAccessToken();
    return token
      ? original.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : original;
  };

  return next(authorized(request)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(store.refreshAccessToken()).pipe(
        switchMap((renewed) =>
          renewed ? next(authorized(request)) : throwError(() => error),
        ),
      );
    }),
  );
};
