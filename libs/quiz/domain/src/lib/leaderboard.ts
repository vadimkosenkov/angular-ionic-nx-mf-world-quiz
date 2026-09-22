import type { CountryDataset } from './country';
import type { QuizSession } from './session';
import type { SessionSummary } from './scoring';
import type { LeaderboardBoard, LeaderboardBoardId } from './vocabulary';
import { CHALLENGE_MODE, leaderboardBoardFor } from './vocabulary';

/**
 * Leaderboard rules (docs/domain/leaderboard.md): a run is ranked only if it
 * is a complete, 100%-correct challenge over the whole World set. Completion
 * time is the score; faster is better.
 */
export type ChallengeIneligibility =
  | 'not-a-challenge'
  | 'not-finished'
  | 'incomplete'
  | 'has-incorrect-answers'
  | 'invalid-question-set';

export type ChallengeEvaluation =
  | {
      readonly eligible: true;
      readonly board: LeaderboardBoard;
      readonly completionTimeMs: number;
    }
  | { readonly eligible: false; readonly reason: ChallengeIneligibility };

export function evaluateChallengeRun(
  session: QuizSession,
  summary: SessionSummary,
  dataset: CountryDataset,
): ChallengeEvaluation {
  if (session.config.mode !== CHALLENGE_MODE) {
    return { eligible: false, reason: 'not-a-challenge' };
  }
  if (session.status !== 'finished' || session.finishedAt === null) {
    return { eligible: false, reason: 'not-finished' };
  }
  if (!summary.completed) {
    return { eligible: false, reason: 'incomplete' };
  }
  if (summary.incorrect > 0) {
    return { eligible: false, reason: 'has-incorrect-answers' };
  }

  // Defensive: every country of the World set exactly once.
  const asked = new Set(session.answers.map((answer) => answer.countryCode));
  const coversWorld =
    session.config.scope === 'world' &&
    asked.size === session.answers.length &&
    asked.size === dataset.length &&
    dataset.every((country) => asked.has(country.code));
  if (!coversWorld) {
    return { eligible: false, reason: 'invalid-question-set' };
  }

  return {
    eligible: true,
    board: leaderboardBoardFor(
      session.config.category,
      session.config.difficulty,
    ),
    completionTimeMs: session.finishedAt - session.startedAt,
  };
}

export interface LeaderboardEntry {
  readonly entryId: string;
  readonly userId: string;
  readonly boardId: LeaderboardBoardId;
  readonly completionTimeMs: number;
  /** Server-recorded time the run was accepted (epoch ms). */
  readonly recordedAt: number;
}

export interface RankedLeaderboardEntry extends LeaderboardEntry {
  /** 1-based position. Unique: ties are broken deterministically. */
  readonly rank: number;
}

/**
 * Total ordering: faster completion first, then the earlier server-recorded
 * run, then entry id (stable, arbitrary but deterministic).
 */
export function compareLeaderboardEntries(
  a: LeaderboardEntry,
  b: LeaderboardEntry,
): number {
  return (
    a.completionTimeMs - b.completionTimeMs ||
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

/** A new personal record must be strictly faster than the previous best. */
export function isNewPersonalRecord(
  previousBestMs: number | null,
  completionTimeMs: number,
): boolean {
  return previousBestMs === null || completionTimeMs < previousBestMs;
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
