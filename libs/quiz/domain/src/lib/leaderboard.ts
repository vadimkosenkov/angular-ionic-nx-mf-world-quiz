import type { QuizSession } from './session';
import type { SessionSummary } from './scoring';
import type {
  LeaderboardBoard,
  LeaderboardBoardId,
  LeaderboardMetric,
} from './vocabulary';
import {
  DEFAULT_FIXED_QUESTION_COUNT,
  isRankedMode,
  leaderboardBoardById,
  leaderboardBoardFor,
} from './vocabulary';

/**
 * Leaderboard rules (docs/domain/leaderboard.md).
 *
 * A board is one of the four choices the quiz setup asks for, and it ranks
 * runs that were **flawless**: a single wrong answer keeps a run off every
 * board. What ranks depends on what the mode holds fixed — a quick round is
 * ten questions, so its time is the score; a timed round is sixty seconds,
 * so how far the player got is the score.
 */
export type RunIneligibility =
  | 'not-a-ranked-mode'
  | 'not-finished'
  | 'incomplete'
  | 'has-incorrect-answers'
  | 'no-answers'
  | 'non-standard-length'
  | 'chosen-countries';

/** What the run achieved, in the terms its board ranks by. */
export interface RankedScore {
  /** Milliseconds on a `time` board, correct answers on a `correct` one. */
  readonly value: number;
  /**
   * The run's own length: from the first question to the last answer. It is
   * the score on a `time` board and the tie-break on a `correct` one, where
   * two players reaching the same number are separated by who got there
   * first.
   */
  readonly timeMs: number;
}

export type RunEvaluation =
  | {
      readonly eligible: true;
      readonly board: LeaderboardBoard;
      readonly score: RankedScore;
    }
  | { readonly eligible: false; readonly reason: RunIneligibility };

/**
 * Whether a finished run belongs on a board, and with what score.
 *
 * The server calls this on the session **it replayed itself** from the
 * uploaded record (quiz-engine.md), so nothing here trusts a number the
 * client sent about its own performance.
 */
export function evaluateRankedRun(
  session: QuizSession,
  summary: SessionSummary,
): RunEvaluation {
  const { config } = session;
  if (!isRankedMode(config.mode)) {
    return { eligible: false, reason: 'not-a-ranked-mode' };
  }
  if (session.status !== 'finished' || session.finishedAt === null) {
    return { eligible: false, reason: 'not-finished' };
  }
  // Practice Mistakes is a quick round over the countries this player got
  // wrong: a set nobody else is asked, and an easier one every time it is
  // played. It is never ranked, whatever its mode says.
  if (config.countryCodes !== undefined) {
    return { eligible: false, reason: 'chosen-countries' };
  }
  if (summary.incorrect > 0) {
    return { eligible: false, reason: 'has-incorrect-answers' };
  }

  const board = leaderboardBoardFor(
    config.category,
    config.difficulty,
    config.scope,
    config.mode,
  );

  if (board.mode === 'fixed') {
    // A quick round is comparable because it is always the same length;
    // a round of three questions would be a different game.
    if (
      (config.questionCount ?? DEFAULT_FIXED_QUESTION_COUNT) !==
      DEFAULT_FIXED_QUESTION_COUNT
    ) {
      return { eligible: false, reason: 'non-standard-length' };
    }
    if (!summary.completed) {
      return { eligible: false, reason: 'incomplete' };
    }
    const timeMs = session.finishedAt - session.startedAt;
    return { eligible: true, board, score: { value: timeMs, timeMs } };
  }

  // A timed round always ends when the clock does, so there is nothing to
  // complete — but a round where nobody answered anything ranks nothing.
  const last = session.answers.at(-1);
  if (!last) return { eligible: false, reason: 'no-answers' };
  return {
    eligible: true,
    board,
    score: {
      value: summary.correct,
      timeMs: last.answeredAt - session.startedAt,
    },
  };
}

export interface LeaderboardEntry {
  readonly entryId: string;
  readonly userId: string;
  readonly boardId: LeaderboardBoardId;
  /** The board's metric: milliseconds, or correct answers. */
  readonly score: number;
  /** The run's own length, the tie-break on a `correct` board. */
  readonly timeMs: number;
  /** Server-recorded time the run was accepted (epoch ms). */
  readonly recordedAt: number;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  /** 1-based position. Unique: ties are broken deterministically. */
  readonly rank: number;
}

/** What the board with this id ranks by. */
export function leaderboardMetricOf(
  boardId: LeaderboardBoardId,
): LeaderboardMetric {
  return leaderboardBoardById(boardId).metric;
}

/**
 * One ascending ranking key for every board: the lower, the better.
 *
 * A time board ranks by the milliseconds themselves; a `correct` board ranks
 * by the number of answers, where *more* is better, so the key is that number
 * negated. One key means one `ORDER BY` and one index serve all 56 boards
 * (backend.md), instead of an order that changes with the board.
 */
export function rankingKey(score: number, metric: LeaderboardMetric): number {
  return metric === 'time' ? score : -score;
}

/**
 * Total ordering within one board: the better score first — faster, or more
 * answers and then faster — then the earlier server-recorded run, then the
 * entry id (stable, arbitrary but deterministic).
 *
 * The metric comes from the first entry's board: entries from two different
 * boards are never ranked against each other.
 */
export function compareLeaderboardEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
): number {
  const metric = leaderboardMetricOf(a.boardId);
  return (
    rankingKey(a.score, metric) - rankingKey(b.score, metric) ||
    a.timeMs - b.timeMs ||
    a.recordedAt - b.recordedAt ||
    (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0)
  );
}

/** Each user's best entry per board (their personal records). */
export function personalBests(
  entries: readonly LeaderboardEntry[],
): LeaderboardEntry[] {
  const best = new Map<string, LeaderboardEntry>();
  for (const entry of entries) {
    // JSON keeps the composite key unambiguous for any id characters.
    const key = JSON.stringify([entry.boardId, entry.userId]);
    const current = best.get(key);
    if (!current || compareLeaderboardEntries(entry, current) < 0) {
      best.set(key, entry);
    }
  }
  return [...best.values()];
}

/** One board's ranking: best entry per user, ordered, ranked from 1. */
export function rankLeaderboard(
  entries: readonly LeaderboardEntry[],
  boardId: LeaderboardBoardId,
): RankedLeaderboardEntry[] {
  return personalBests(entries.filter((entry) => entry.boardId === boardId))
    .sort(compareLeaderboardEntries)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/**
 * A new personal record must be strictly better than the previous best: a
 * faster time, or more answers — and with the same number of answers, a
 * faster one.
 */
export function isNewPersonalRecord(
  previous: RankedScore | null,
  score: RankedScore,
  metric: LeaderboardMetric,
): boolean {
  if (previous === null) return true;
  if (metric === 'time') return score.value < previous.value;
  return (
    score.value > previous.value ||
    (score.value === previous.value && score.timeMs < previous.timeMs)
  );
}

/**
 * A leaderboard time as players read it: minutes, seconds and tenths, e.g.
 * `4:07.3` (rounded down, like a stopwatch). Shared by the app and the site.
 */
export function formatRunTime(ms: number): string {
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = `${Math.floor((tenths % 600) / 10)}`.padStart(2, '0');
  return `${minutes}:${seconds}.${tenths % 10}`;
}
