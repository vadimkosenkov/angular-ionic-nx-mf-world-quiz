import {
  DestroyRef,
  DOCUMENT,
  effect,
  type EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
  untracked,
} from '@angular/core';
import { AuthStore } from '@world-quiz/client/auth';
import { createDexieLocalStore } from './dexie-local-store';
import { LOCAL_STORE } from './local-store';
import { ProgressStore } from './progress.store';
import { SyncService } from './sync.service';

/**
 * Progress kept on the device (IndexedDB) and synced with the account.
 *
 * Loads the device's data at start-up and syncs whenever the result could
 * change: when the player is signed in (at start-up or after sign-in), when
 * the browser comes back online, and when the app returns to the foreground.
 * Finished sessions also ask for a sync (`ShellQuizResultSink`).
 *
 * Requires `provideAuth()`.
 */
export function provideProgress(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: LOCAL_STORE, useFactory: () => createDexieLocalStore() },
    provideEnvironmentInitializer(() => {
      void inject(ProgressStore).load();

      const auth = inject(AuthStore);
      const sync = inject(SyncService);
      effect(() => {
        if (auth.status() === 'signed-in') untracked(() => void sync.sync());
      });

      const document = inject(DOCUMENT);
      const window = document.defaultView;
      const onOnline = () => void sync.sync();
      const onVisible = () => {
        if (document.visibilityState === 'visible') void sync.sync();
      };
      window?.addEventListener('online', onOnline);
      document.addEventListener('visibilitychange', onVisible);
      inject(DestroyRef).onDestroy(() => {
        window?.removeEventListener('online', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
      });
    }),
  ]);
}
