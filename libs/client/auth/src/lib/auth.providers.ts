import {
  DestroyRef,
  DOCUMENT,
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { AuthStore } from './auth.store';

/**
 * Sign-in for the app. Restores a previous sign-in at start-up without
 * blocking the first render: the app starts signed out-or-unknown and updates
 * when the refresh answers.
 *
 * Also add `withInterceptors([authInterceptor])` to `provideHttpClient()`.
 */
export function provideAuth(config: AuthConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AUTH_CONFIG, useValue: config },
    provideEnvironmentInitializer(() => {
      const store = inject(AuthStore);
      void store.restore();

      // A sign-in that could not be checked offline is checked on reconnect.
      const window = inject(DOCUMENT).defaultView;
      const onOnline = () => {
        if (store.status() === 'unverified') void store.restore();
      };
      window?.addEventListener('online', onOnline);
      inject(DestroyRef).onDestroy(() =>
        window?.removeEventListener('online', onOnline),
      );
    }),
  ]);
}
