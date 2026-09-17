import type {
  Locale,
  QuizCategory,
  QuizScope,
  Region,
  Subregion,
} from './vocabulary';
import { LOCALES, SUBREGIONS } from './vocabulary';

/** Lowercase ISO 3166-1 alpha-2 code, e.g. `fr`. Stable identifier of a country. */
export type CountryCode = string;

export type LocalizedText = Readonly<Record<Locale, string>>;

/** Extra accepted spellings per locale (Hard mode only; never displayed). */
export type LocalizedAliases = Readonly<
  Partial<Record<Locale, readonly string[]>>
>;

/**
 * One country of the static dataset.
 *
 * `name` and `capital` are the display values. `*Aliases` hold additional
 * answers accepted in Hard mode: common alternative names ("USA"), former or
 * transliterated spellings ("Kiev"), and other legitimate capitals of
 * countries with more than one (Bolivia: La Paz). Aliases are never shown as
 * Easy-mode choices.
 */
export interface Country {
  readonly code: CountryCode;
  readonly region: Region;
  readonly subregion: Subregion;
  readonly name: LocalizedText;
  readonly nameAliases?: LocalizedAliases;
  readonly capital: LocalizedText;
  readonly capitalAliases?: LocalizedAliases;
}

export type CountryDataset = readonly Country[];

/** Countries a quiz with this scope draws from, in dataset order. */
export function countriesInScope(
  dataset: CountryDataset,
  scope: QuizScope,
): readonly Country[] {
  return scope === 'world'
    ? dataset
    : dataset.filter((country) => country.region === scope);
}

/** Lookup table by country code. */
export function indexCountriesByCode(
  dataset: CountryDataset,
): ReadonlyMap<CountryCode, Country> {
  return new Map(dataset.map((country) => [country.code, country]));
}

/**
 * The value a question of `category` asks for:
 * Capitals → the capital, Flags → the country name.
 */
export function displayAnswer(
  country: Country,
  category: QuizCategory,
  locale: Locale,
): string {
  return (category === 'capitals' ? country.capital : country.name)[locale];
}

/** Every text accepted as a correct answer, across all locales, display values first. */
export function acceptedAnswers(
  country: Country,
  category: QuizCategory,
): readonly string[] {
  const primary = category === 'capitals' ? country.capital : country.name;
  const aliases =
    category === 'capitals' ? country.capitalAliases : country.nameAliases;

  return [
    ...LOCALES.map((locale) => primary[locale]),
    ...LOCALES.flatMap((locale) => aliases?.[locale] ?? []),
  ];
}

export interface DatasetIssue {
  readonly code: CountryCode;
  readonly message: string;
}

const COUNTRY_CODE_PATTERN = /^[a-z]{2}$/;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const LATIN = /\p{Script=Latin}/u;

/**
 * Structural validation of a dataset. Returns every problem found instead of
 * throwing, so a test can report all issues at once.
 */
export function validateDataset(dataset: CountryDataset): DatasetIssue[] {
  const issues: DatasetIssue[] = [];
  const seenCodes = new Set<CountryCode>();

  for (const country of dataset) {
    const report = (message: string) =>
      issues.push({ code: country.code, message });

    if (!COUNTRY_CODE_PATTERN.test(country.code)) {
      report('code must be a lowercase ISO 3166-1 alpha-2 code');
    }
    if (seenCodes.has(country.code)) {
      report('duplicate code');
    }
    seenCodes.add(country.code);

    if (SUBREGIONS[country.subregion] !== country.region) {
      report(
        `subregion "${country.subregion}" does not belong to region "${country.region}"`,
      );
    }

    for (const [field, texts] of [
      ['name', country.name],
      ['capital', country.capital],
    ] as const) {
      if (!texts.en.trim() || !LATIN.test(texts.en)) {
        report(`${field}.en must be non-empty Latin text`);
      }
      if (!texts.ru.trim() || !CYRILLIC.test(texts.ru)) {
        report(`${field}.ru must be non-empty Cyrillic text`);
      }
    }

    for (const [field, aliases] of [
      ['nameAliases', country.nameAliases],
      ['capitalAliases', country.capitalAliases],
    ] as const) {
      for (const text of [...(aliases?.en ?? []), ...(aliases?.ru ?? [])]) {
        if (!text.trim()) {
          report(`${field} must not contain blank values`);
        }
      }
      if (aliases?.ru?.some((text) => !CYRILLIC.test(text))) {
        report(`${field}.ru must be Cyrillic`);
      }
    }
  }

  return issues;
}
