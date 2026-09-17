import type { Country, CountryCode, CountryDataset } from './country';
import type { RandomSource } from './random';
import { createSeededRandom, deriveSeed, shuffled } from './random';
import type { Difficulty } from './vocabulary';
import { EASY_CHOICE_COUNT } from './vocabulary';

export interface QuizQuestion {
  /** Zero-based position in the session. */
  readonly index: number;
  /** The country being asked about (and the correct answer). */
  readonly countryCode: CountryCode;
  /**
   * Easy mode only: the offered options as country codes, including the
   * correct one, in display order. The UI renders each option's capital
   * (Capitals) or name (Flags) in the current language.
   */
  readonly choices?: readonly CountryCode[];
}

/**
 * Picks Easy-mode options: the correct country plus distractors, preferring
 * plausible neighbours so the question is not trivially easy.
 *
 * Distractor tiers, each shuffled: same UN sub-region → same region → rest of
 * the world. Distractors always come from the full dataset, even when the quiz
 * itself is restricted (a region quiz or practice mistakes).
 */
export function generateChoices(
  correct: Country,
  dataset: CountryDataset,
  random: RandomSource,
  count: number = EASY_CHOICE_COUNT,
): CountryCode[] {
  const candidates = dataset.filter((country) => country.code !== correct.code);
  const tiers = [
    candidates.filter((country) => country.subregion === correct.subregion),
    candidates.filter(
      (country) =>
        country.region === correct.region &&
        country.subregion !== correct.subregion,
    ),
    candidates.filter((country) => country.region !== correct.region),
  ];

  const distractors: CountryCode[] = [];
  for (const tier of tiers) {
    for (const country of shuffled(tier, random)) {
      if (distractors.length === count - 1) break;
      distractors.push(country.code);
    }
  }

  return shuffled([correct.code, ...distractors], random);
}

export interface QuestionSource {
  /** Number of questions, or `null` when questions continue indefinitely (Endless, Timed). */
  readonly length: number | null;
  /** Number of distinct countries questions are drawn from. */
  readonly poolSize: number;
  /** Deterministic: the same seed and index always return the same question. */
  questionAt(index: number): QuizQuestion;
}

export interface QuestionSourceOptions {
  readonly dataset: CountryDataset;
  /** Countries to ask about, in dataset order. Must not be empty. */
  readonly pool: readonly Country[];
  readonly difficulty: Difficulty;
  readonly length: number | null;
  readonly seed: string;
}

/**
 * Lazily generates the questions of one session from its seed.
 *
 * The pool is shuffled into a "cycle". Fixed sessions and challenges take
 * the first `length` questions of cycle 0, so no country repeats. Endless and
 * Timed sessions continue with a freshly shuffled cycle whenever the pool is
 * exhausted, and never ask the same country twice in a row across a boundary.
 */
export function createQuestionSource(
  options: QuestionSourceOptions,
): QuestionSource {
  const { dataset, pool, difficulty, length, seed } = options;
  if (pool.length === 0) {
    throw new RangeError('A question source needs at least one country.');
  }
  if (length !== null && (length < 1 || length > pool.length)) {
    throw new RangeError(
      `length must be between 1 and the pool size (${pool.length}), received ${length}`,
    );
  }

  const byCode = new Map(pool.map((country) => [country.code, country]));
  const cycles = new Map<number, readonly CountryCode[]>();

  const cycleOrder = (cycle: number): readonly CountryCode[] => {
    const cached = cycles.get(cycle);
    if (cached) return cached;

    const order = shuffled(
      pool.map((country) => country.code),
      createSeededRandom(deriveSeed(seed, 'order', cycle)),
    );
    if (cycle > 0 && order.length > 1) {
      const previous = cycleOrder(cycle - 1);
      if (order[0] === previous[previous.length - 1]) {
        [order[0], order[1]] = [
          order[1] as CountryCode,
          order[0] as CountryCode,
        ];
      }
    }
    cycles.set(cycle, order);
    return order;
  };

  return {
    length,
    poolSize: pool.length,
    questionAt(index: number): QuizQuestion {
      if (!Number.isInteger(index) || index < 0) {
        throw new RangeError(`Invalid question index ${index}`);
      }
      if (length !== null && index >= length) {
        throw new RangeError(
          `Question ${index} is out of range (length ${length})`,
        );
      }

      const cycle = Math.floor(index / pool.length);
      const countryCode = cycleOrder(cycle)[index % pool.length] as CountryCode;
      if (difficulty === 'hard') {
        return { index, countryCode };
      }

      const country = byCode.get(countryCode) as Country;
      const choices = generateChoices(
        country,
        dataset,
        createSeededRandom(deriveSeed(seed, 'choices', index)),
      );
      return { index, countryCode, choices };
    },
  };
}
