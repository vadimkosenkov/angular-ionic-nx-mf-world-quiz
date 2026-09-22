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
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const { apiUrl } = inject(AUTH_CONFIG);
  const store = inject(AuthStore);

  if (
    !request.url.startsWith(`${apiUrl}/`) ||
    request.url.startsWith(`${apiUrl}/v1/auth/`)
  ) {
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
