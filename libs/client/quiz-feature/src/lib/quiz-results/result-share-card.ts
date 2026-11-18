import type { ShareCard, TranslateFn } from '@world-quiz/client/ui';
import { shareClaim, shareMedal } from '@world-quiz/client/ui';
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
  /** The place the run earned on a public board, if it earned one. */
  readonly rank: number | null;
  /** How many players that board holds; only meaningful with a rank. */
  readonly players: number | null;
}

/**
 * The words of the picture a run is shared as, built outside the component
 * so they are tested without rendering a screen (as `country-rows.ts` does
 * for the countries reference).
 *
 * The claim is first — what the player would have typed above the picture —
 * then the score that backs it, then what was played and how. A place in
 * the first three gets its medal, and accuracy and time stay as the figures
 * at the foot, because a run is about how it went and not only about where
 * it landed.
 */
export function runShareCard(
  run: RunShareFacts,
  translate: TranslateFn,
): ShareCard {
  // A board nobody else is on is nobody to have beaten, and a board whose
  // size the run never learned is read the same way: the card says "First
  // result on this board" there, so the claim must not boast either.
  const alone = run.rank !== null && (run.players ?? 0) <= 1;
  const claim = shareClaim({
    rank: run.rank,
    players: alone ? 1 : run.players,
    perfect: run.perfect,
  });
  return {
    title: translate('share.title'),
    claim: translate(`share.claim.${claim}`),
    headline: `${run.correct} / ${run.answered}`,
    subject: translate('share.result.subject', {
      category: translate(`categories.${run.category}`),
      region: translate(`regions.${run.scope}`),
      difficulty: translate(`difficulty.${run.difficulty}`),
    }),
    detail: translate(`modes.${run.mode}`),
    medal: alone ? null : shareMedal(run.rank),
    note: rankNote(run, alone, translate),
    stats: [
      {
        label: translate('results.accuracy'),
        value: `${run.accuracyPercent}%`,
      },
      { label: translate('results.time'), value: run.duration },
    ],
    callToAction: translate('share.beatMe'),
  };
}

/**
 * Where the run landed, for a place no medal carries: the first three have
 * it written on the disc, and the card leaves this line out for them. A run
 * that reached no board has nothing to say here at all — the claim has
 * already said whether it was flawless, and an empty line is better than a
 * sentence about not ranking.
 */
function rankNote(
  run: RunShareFacts,
  alone: boolean,
  translate: TranslateFn,
): string | null {
  if (run.rank === null) return null;
  return alone
    ? translate('share.firstOnBoard')
    : translate('leaderboard.place', {
        rank: run.rank,
        players: run.players ?? 0,
      });
}
