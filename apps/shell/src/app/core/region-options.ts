import { computed, inject, type Signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { pluralCategory } from '@world-quiz/client/i18n';
import { ProgressStore } from '@world-quiz/client/progress';
import type { RegionOption } from '@world-quiz/client/ui';
import { countriesInScope, QUIZ_SCOPES } from '@world-quiz/quiz/domain';

/**
 * The regions for `wq-region-options`, named in the display language and
 * counted from the dataset.
 *
 * Two screens ask which part of the world they are about — the quiz setup
 * and the countries reference — and they must offer the same list, or a
 * player would wonder which one is right. The counts are worked out once
 * (the dataset is fixed for the life of the app); only the names follow the
 * language, which is why the signal reads `activeLang()`.
 *
 * "(44)" on its own tells a screen reader nothing, so each option also
 * carries the whole button's accessible name, with the number spelled out.
 */
export function regionOptions(): Signal<readonly RegionOption[]> {
  const dataset = inject(ProgressStore).dataset;
  const transloco = inject(TranslocoService);
  const counted = QUIZ_SCOPES.map((scope) => ({
    scope,
    count: countriesInScope(dataset, scope).length,
  }));

  return computed(() => {
    const lang = transloco.activeLang();
    return counted.map(({ scope, count }) => {
      const name = transloco.translate(`regions.${scope}`, {}, lang);
      const countries = transloco.translate(
        `counts.countries.${pluralCategory(lang, count)}`,
        { count },
        lang,
      );
      return { scope, count, name, label: `${name}, ${countries}` };
    });
  });
}
