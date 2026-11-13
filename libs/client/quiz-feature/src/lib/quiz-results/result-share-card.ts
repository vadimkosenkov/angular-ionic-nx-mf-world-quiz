import type { ShareCard, TranslateFn } from '@world-quiz/client/ui';
import type {
  Difficulty,
  QuizCategory,
  QuizMode,
  QuizScope,
} from '@world-quiz/quiz/domain';

/**
 * How the run was played, as the picture names it. Practice Mistakes is a
 * Quick round to the domain, but not to the player, so the shared picture
 * has to be able to say so.
 */
export type SharedQuizMode = QuizMode | 'practice';

/** What the picture of a finished run is made of. */
export interface RunShareFacts {
  readonly category: QuizCategory;
  readonly scope: QuizScope;
  readonly difficulty: Difficulty;
  readonly mode: SharedQuizMode;
  readonly correct: number;
  readonly answered: number;
  readonly accuracyPercent: number;
  /** Already formatted, as the screen shows it ("1:12"). */
  readonly duration: string;
  readonly perfect: boolean;
  /** The ranked line of a challenge, already translated; `null` otherwise. */
  readonly rank: string | null;
}

/**
 * The words of the picture a run is shared as, built outside the component
 * so they are tested without rendering a screen (as `country-rows.ts` does
 * for the countries reference).
 *
 * It says what the message says, laid out as a card: what was asked for,
 * where and how hard above the score, how it was played on its own line
 * under that, and accuracy and time as the figures beneath. The line
 * between them is the rank the server gave — or, failing that, a perfect
 * run.
 */
export function runShareCard(
  run: RunShareFacts,
  translate: TranslateFn,
): ShareCard {
  return {
    title: translate('share.title'),
    subject: translate('share.result.subject', {
      category: translate(`categories.${run.category}`),
      region: translate(`regions.${run.scope}`),
      difficulty: translate(`difficulty.${run.difficulty}`),
    }),
    detail: translate(`modes.${run.mode}`),
    headline: `${run.correct} / ${run.answered}`,
    note: run.rank ?? (run.perfect ? translate('results.perfect') : null),
    stats: [
      {
        label: translate('results.accuracy'),
        value: `${run.accuracyPercent}%`,
      },
      { label: translate('results.time'), value: run.duration },
    ],
  };
}
