import {
  effect,
  type EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { NavController } from '@ionic/angular';
import { AuthStore, type AuthStatus } from '@world-quiz/client/auth';

/**
 * Returns to the welcome screen whenever a sign-in ends: signing out, deleting
 * the account, or the API refusing the refresh token. The route guards decide
 * at navigation time; this covers a sign-in that ends while a page is open.
 */
export function provideSignInFlow(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const auth = inject(AuthStore);
    const nav = inject(NavController);
    let previous: AuthStatus = auth.status();
    effect(() => {
      const status = auth.status();
      const ended =
        status === 'signed-out' &&
        (previous === 'signed-in' || previous === 'unverified');
      previous = status;
      // A new root: Ionic drops the cached pages of the signed-in player.
      if (ended) void nav.navigateRoot('/welcome');
    });
  });
}
