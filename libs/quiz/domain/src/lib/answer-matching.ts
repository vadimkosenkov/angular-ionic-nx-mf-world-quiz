import type { CountryCode, CountryDataset } from './country';
import { acceptedAnswers } from './country';
import type { QuizCategory } from './vocabulary';

/**
 * Hard-mode answer matching: deterministic, local, no AI.
 *
 * Typed and dictated answers take the same path:
 *   1. `normalizeAnswer` turns free text into a comparison key.
 *   2. An exact key match against the correct country's accepted answers wins.
 *   3. Otherwise a small number of typos is tolerated, but only if the input
 *      is strictly closer to the correct answer than to any other country's
 *      answer. This "ambiguity guard" rejects real mistakes such as "Iraq"
 *      for Iran or "Zambia" for Gambia.
 *
 * See docs/domain/answer-matching.md for the full rationale.
 */

const STOP_WORDS: ReadonlySet<string> = new Set(['the', 'and', 'of', 'и']);
const TOKEN_REPLACEMENTS: ReadonlyMap<string, string> = new Map([
  ['st', 'saint'],
]);
/** Apostrophes and dots are removed without splitting words: "N'Djamena", "D.C.". */
const JOINING_PUNCTUATION = /['’‘ʼʻ`´.]/g;
/** Everything else that is not a letter or digit separates words. */
const SEPARATORS = /[^\p{L}\p{N}]+/u;
const COMBINING_MARKS = /\p{M}/gu;

/**
 * Converts free text into a comparison key:
 * - Unicode NFC, lowercase;
 * - `ё` → `е`; Latin diacritics removed (`São Tomé` → `sao tome`), `й` kept;
 * - apostrophes and dots removed, other punctuation/dashes/whitespace split words;
 * - `st` → `saint`; the words `the`, `and`, `of`, `и` dropped;
 * - words joined without spaces (`Port-au-Prince` = `port au prince` = `portauprince`).
 */
export function normalizeAnswer(input: string): string {
  const lower = input.normalize('NFC').toLowerCase().replace(/ё/g, 'е');

  const withoutDiacritics = Array.from(lower, (character) =>
    character === 'й'
      ? character
      : character.normalize('NFD').replace(COMBINING_MARKS, ''),
  ).join('');

  return withoutDiacritics
    .replace(JOINING_PUNCTUATION, '')
    .split(SEPARATORS)
    .filter((token) => token.length > 0)
    .map((token) => TOKEN_REPLACEMENTS.get(token) ?? token)
    .filter((token) => !STOP_WORDS.has(token))
    .join('');
}

/**
 * Optimal-string-alignment distance (Levenshtein + adjacent transpositions).
 * Stops early and returns `max + 1` as soon as the distance must exceed `max`.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const tooFar = max + 1;

  if (Math.abs(left.length - right.length) > max) {
    return tooFar;
  }
  if (left.length === 0 || right.length === 0) {
    return Math.max(left.length, right.length);
  }

  let previousPrevious: number[] = [];
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    let rowMinimum = i;

    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      let value = Math.min(
        (previous[j] as number) + 1,
        (current[j - 1] as number) + 1,
        (previous[j - 1] as number) + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        value = Math.min(value, (previousPrevious[j - 2] as number) + 1);
      }
      current[j] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > max) {
      return tooFar;
    }
    previousPrevious = previous;
    previous = current;
  }

  const distance = previous[right.length] as number;
  return distance > max ? tooFar : distance;
}

/**
 * How many edits are tolerated for an accepted answer of this key length.
 * Conservative on purpose: short names allow no typos at all.
 */
export function typoTolerance(keyLength: number): number {
  if (keyLength <= 3) return 0;
  if (keyLength <= 7) return 1;
  if (keyLength <= 12) return 2;
  return 3;
}

export interface AnswerIndexEntry {
  readonly countryCode: CountryCode;
  /** The accepted answer as written in the dataset. */
  readonly text: string;
  readonly key: string;
}

/** All accepted answers of one question category, precomputed for matching. */
export interface AnswerIndex {
  readonly category: QuizCategory;
  readonly entries: readonly AnswerIndexEntry[];
  readonly entriesByCountry: ReadonlyMap<
    CountryCode,
    readonly AnswerIndexEntry[]
  >;
  /** Normalized key → countries that accept it (normally exactly one). */
  readonly countriesByKey: ReadonlyMap<string, readonly CountryCode[]>;
}

export function buildAnswerIndex(
  dataset: CountryDataset,
  category: QuizCategory,
): AnswerIndex {
  const entries: AnswerIndexEntry[] = [];
  const entriesByCountry = new Map<CountryCode, AnswerIndexEntry[]>();
  const countriesByKey = new Map<string, CountryCode[]>();

  for (const country of dataset) {
    const own: AnswerIndexEntry[] = [];
    for (const text of acceptedAnswers(country, category)) {
      const key = normalizeAnswer(text);
      if (!key || own.some((entry) => entry.key === key)) continue;

      const entry = { countryCode: country.code, text, key };
      own.push(entry);
      entries.push(entry);
      countriesByKey.set(key, [
        ...(countriesByKey.get(key) ?? []),
        country.code,
      ]);
    }
    entriesByCountry.set(country.code, own);
  }

  return { category, entries, entriesByCountry, countriesByKey };
}

export type AnswerMatch =
  | { readonly kind: 'exact'; readonly matchedText: string }
  | {
      readonly kind: 'typo';
      readonly matchedText: string;
      readonly distance: number;
    }
  | {
      readonly kind: 'incorrect';
      /** Set when the input is exactly another country's answer. */
      readonly matchedCountryCode?: CountryCode;
    };

/** Grades a free-text answer for the country `correctCode`. */
export function matchAnswer(
  index: AnswerIndex,
  correctCode: CountryCode,
  input: string,
): AnswerMatch {
  const key = normalizeAnswer(input);
  if (!key) {
    return { kind: 'incorrect' };
  }

  const own = index.entriesByCountry.get(correctCode) ?? [];

  const exact = own.find((entry) => entry.key === key);
  if (exact) {
    return { kind: 'exact', matchedText: exact.text };
  }

  const otherCountry = index.countriesByKey
    .get(key)
    ?.find((code) => code !== correctCode);
  if (otherCountry !== undefined) {
    return { kind: 'incorrect', matchedCountryCode: otherCountry };
  }

  let best: { entry: AnswerIndexEntry; distance: number } | undefined;
  for (const entry of own) {
    const tolerance = typoTolerance(Array.from(entry.key).length);
    const distance = boundedEditDistance(key, entry.key, tolerance);
    if (distance <= tolerance && (!best || distance < best.distance)) {
      best = { entry, distance };
    }
  }
  if (!best) {
    return { kind: 'incorrect' };
  }

  // Ambiguity guard: another country's answer must be strictly farther away.
  const { entry: matched, distance } = best;
  const isAmbiguous = index.entries.some(
    (entry) =>
      entry.countryCode !== correctCode &&
      boundedEditDistance(key, entry.key, distance) <= distance,
  );
  if (isAmbiguous) {
    return { kind: 'incorrect' };
  }

  return { kind: 'typo', matchedText: matched.text, distance };
}
