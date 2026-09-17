import { isLocale, type Locale } from '@world-quiz/quiz/domain';
import { DEFAULT_LOCALE } from './i18n.providers';

/**
 * Picks the first supported language from the device's preferred languages
 * (`navigator.languages`), e.g. `['ru-RU', 'en']` → `ru`.
 */
export function detectLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    if (isLocale(language)) {
      return language;
    }
  }
  return DEFAULT_LOCALE;
}
