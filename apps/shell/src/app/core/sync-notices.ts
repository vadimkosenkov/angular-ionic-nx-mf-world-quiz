import {
  effect,
  type EnvironmentProviders,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { pluralCategory } from '@world-quiz/client/i18n';
import { SyncService } from '@world-quiz/client/progress';
import { Toasts } from '@world-quiz/client/ui';

/**
 * Says when results that had been waiting finally reached the account.
 *
 * The app plays on without a connection and says nothing at the time, so the
 * player is left with results that exist only on this device. That loop is
 * closed here, on the screen they happen to be on — the sync runs in the
 * background (coming back online, or to the foreground), so there is no
 * screen of its own to say it on.
 *
 * Only a sync that had failed before reports itself (`SyncService.recovered`):
 * the ordinary one after a finished quiz would otherwise say so every time.
 */
export function provideSyncNotices(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const sync = inject(SyncService);
    const toasts = inject(Toasts);
    const transloco = inject(TranslocoService);

    effect(() => {
      const recovery = sync.recovered();
      if (!recovery) return;
      const lang = transloco.getActiveLang();
      const form = pluralCategory(lang, recovery.sent);
      toasts.success(
        transloco.translate(
          `settings.account.sync.caughtUp.${form}`,
          { count: recovery.sent },
          lang,
        ),
      );
    });
  });
}
