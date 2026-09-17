import {
  DOCUMENT,
  effect,
  type EnvironmentProviders,
  inject,
  Injectable,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SettingsStore } from './settings.store';

/** Ionic's class for its class-based dark palette (`palettes/dark.class.css`). */
export const DARK_PALETTE_CLASS = 'ion-palette-dark';

/**
 * Keeps the document in sync with the settings:
 * - `<html class="ion-palette-dark">` and `color-scheme` for the theme;
 * - `<html lang>` and the active Transloco language for the locale.
 */
@Injectable({ providedIn: 'root' })
export class DocumentSettingsSync {
  private readonly store = inject(SettingsStore);
  private readonly transloco = inject(TranslocoService);
  private readonly root = inject(DOCUMENT).documentElement;

  constructor() {
    effect(() => {
      const scheme = this.store.colorScheme();
      this.root.classList.toggle(DARK_PALETTE_CLASS, scheme === 'dark');
      this.root.style.colorScheme = scheme;
    });

    effect(() => {
      const locale = this.store.locale();
      this.root.lang = locale;
      this.transloco.setActiveLang(locale);
    });
  }
}

/**
 * Loads settings and the matching translations before the first render, so
 * the app never flashes the wrong theme or untranslated keys.
 */
export function provideAppSettings(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(async () => {
      const store = inject(SettingsStore);
      const transloco = inject(TranslocoService);
      inject(DocumentSettingsSync);

      await store.load();
      // `defaultValue` keeps start-up alive if loading is cancelled (e.g. teardown).
      await firstValueFrom(transloco.load(store.locale()), {
        defaultValue: undefined,
      });
    }),
  ]);
}
