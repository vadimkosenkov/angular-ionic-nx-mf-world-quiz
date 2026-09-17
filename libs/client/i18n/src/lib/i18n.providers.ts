import {
  type EnvironmentProviders,
  Injectable,
  isDevMode,
} from '@angular/core';
import {
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { LOCALES, type Locale } from '@world-quiz/quiz/domain';
import { from, type Observable } from 'rxjs';

/** Language used when nothing else is known (and as the fallback for missing keys). */
export const DEFAULT_LOCALE: Locale = 'en';

const TRANSLATIONS: Readonly<Record<Locale, () => Promise<Translation>>> = {
  en: () => import('./translations/en').then((module) => module.en),
  ru: () => import('./translations/ru').then((module) => module.ru),
};

/**
 * Loads translations from lazily imported TypeScript modules instead of HTTP.
 * They are bundled with the app (separate chunks per language), so the UI is
 * translated offline, inside Capacitor, and inside federated remotes, without
 * depending on an assets URL.
 */
@Injectable({ providedIn: 'root' })
export class BundledTranslationLoader implements TranslocoLoader {
  getTranslation(lang: string): Observable<Translation> {
    const load = TRANSLATIONS[lang as Locale];
    if (!load) {
      throw new Error(`Unsupported language "${lang}"`);
    }
    return from(load());
  }
}

/** Transloco configured for World Quiz. Call once in the application config. */
export function provideAppI18n(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...LOCALES],
      defaultLang: DEFAULT_LOCALE,
      fallbackLang: DEFAULT_LOCALE,
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
      missingHandler: {
        logMissingKey: isDevMode(),
        useFallbackTranslation: true,
      },
    },
    loader: BundledTranslationLoader,
  });
}
