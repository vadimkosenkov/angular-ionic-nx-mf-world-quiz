import { inject, Pipe, type PipeTransform } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Translates a countable phrase using the language's plural rules:
 *
 *   {{ 'counts.countries' | wqPlural: 195 }}  →  "195 countries" / "195 стран"
 *
 * The key must have `one`, `few`, `many` and `other` children. The category
 * comes from the standard `Intl.PluralRules`, so no extra i18n library is
 * needed. Impure on purpose: the result changes when the language changes.
 */
@Pipe({ name: 'wqPlural', pure: false })
export class PluralPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(key: string, count: number): string {
    const lang = this.transloco.activeLang();
    const category = pluralCategory(lang, count);
    return this.transloco.translate(`${key}.${category}`, { count }, lang);
  }
}

type SupportedPluralCategory = 'one' | 'few' | 'many' | 'other';

/** Maps `Intl.PluralRules` output to the four forms our translations provide. */
export function pluralCategory(
  lang: string,
  count: number,
): SupportedPluralCategory {
  const category = new Intl.PluralRules(lang).select(count);
  return category === 'one' || category === 'few' || category === 'many'
    ? category
    : 'other';
}
