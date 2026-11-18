import {
  evaluateRankedRun,
  isNewPersonalRecord,
  type LeaderboardBoard,
  type LeaderboardBoardId,
  type QuizSession,
  type RankedScore,
  rankingKey,
  type SessionSummary,
} from '@world-quiz/quiz/domain';

/**
 * The shortest time a ranked answer can plausibly have taken.
 *
 * Boards are fed by ordinary games, so there is no server-issued seed to
 * measure a run against any more (ADR-014): the API cannot prove that a run
 * really took the time it claims. What it can do is refuse a time nobody
 * could have played — ten correct answers in under two and a half seconds is
 * a forged payload, not a fast player.
 */
export const MIN_RANKED_ANSWER_MS = 250;

/** A run that belongs on a board, before its place is known. */
export interface RankedRun {
  readonly board: LeaderboardBoard;
  readonly score: RankedScore;
}

/** What the server stores about a ranked run. */
export interface RankedRunVerdict {
  readonly board: LeaderboardBoardId;
  /** The board's metric: milliseconds, or correct answers. */
  readonly score: number;
  /** The run's own length: the tie-break where the score is a count. */
  readonly timeMs: number;
  /** The one ascending ranking key every board is ordered by. */
  readonly rankKey: number;
  readonly personalRecord: boolean;
}

/**
 * Whether a recorded session earned a place on a board.
 *
 * The domain decides it (docs/domain/leaderboard.md): a ranked mode, played
 * to the end, every answer correct. It is called on the session the server
 * **replayed itself**, so no number the client sent about its own performance
 * is trusted. On top of that the server refuses an impossible time.
 */
export function rankedRunOf(
  session: QuizSession,
  summary: SessionSummary,
): RankedRun | null {
  const evaluation = evaluateRankedRun(session, summary);
  if (!evaluation.eligible) return null;
  if (evaluation.score.timeMs < summary.answered * MIN_RANKED_ANSWER_MS) {
    return null;
  }
  return { board: evaluation.board, score: evaluation.score };
}

/** The run as it is stored, given the player's best run on the board so far. */
export function verdictOf(
  run: RankedRun,
  previousBest: RankedScore | null,
): RankedRunVerdict {
  const { metric } = run.board;
  return {
    board: run.board.id,
    score: run.score.value,
    timeMs: run.score.timeMs,
    rankKey: rankingKey(run.score.value, metric),
    personalRecord: isNewPersonalRecord(previousBest, run.score, metric),
  };
}

/**
 * A verdict as it is read back from the database: the ranking key is only
 * ever used to order rows, so nothing outside SQL needs it again.
 */
export type StoredRankedRun = Omit<RankedRunVerdict, 'rankKey'>;
