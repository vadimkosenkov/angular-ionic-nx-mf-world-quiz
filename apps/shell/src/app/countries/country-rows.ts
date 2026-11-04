import { flagAssetPath } from '@world-quiz/quiz/countries';
import {
  countriesInScope,
  isMastered,
  masteryOf,
  QUIZ_CATEGORIES,
  type Country,
  type CountryDataset,
  type Locale,
  type ProgressMap,
  type QuizCategory,
  type QuizScope,
} from '@world-quiz/quiz/domain';

export interface CountryRow {
  readonly country: Country;
  /** The display name in the player's language, used for sorting too. */
  readonly name: string;
  readonly capital: string;
  readonly flag: string;
  /**
   * Whether each fact of this country is mastered. Mastery is kept per
   * category (`capitals:fr` and `flags:fr` are separate states), so the
   * capital and the flag answer separately: a player can know France's flag
   * and never have been asked for its capital.
   */
  readonly mastered: Readonly<Record<QuizCategory, boolean>>;
}

/**
 * The reference list: every country of the chosen region, in the player's
 * own alphabet. The dataset's own order is by region, which reads as no
 * order at all once a region has been picked.
 */
export function countryRows(
  dataset: CountryDataset,
  progress: ProgressMap,
  scope: QuizScope,
  locale: Locale,
): readonly CountryRow[] {
  const collator = new Intl.Collator(locale);
  return countriesInScope(dataset, scope)
    .map((country) => ({
      country,
      name: country.name[locale],
      capital: country.capital[locale],
      flag: flagAssetPath(country.code),
      mastered: Object.fromEntries(
        QUIZ_CATEGORIES.map((category) => [
          category,
          isMastered(masteryOf(progress, category, country.code)),
        ]),
      ) as Record<QuizCategory, boolean>,
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}
