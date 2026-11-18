import type { LeaderboardBoardId, RankedScore } from '@world-quiz/quiz/domain';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../db/database';
import { leaderboardRuns, users } from '../db/schema';

/** One player's best run on a board, with the place it holds. */
export interface RankedPlace {
  readonly userId: string;
  readonly nickname: string | null;
  readonly rank: number;
  /** How many players have a ranked run on the board. */
  readonly players: number;
  readonly score: number;
  readonly timeMs: number;
  readonly recordedAt: number;
}

export interface PlayerRecord extends RankedPlace {
  readonly board: LeaderboardBoardId;
}

/**
 * Rankings. Knows SQL, not quiz rules.
 *
 * A ranking is a query over the ranked runs (docs/domain/leaderboard.md):
 * each player's best run (`DISTINCT ON`), numbered by `row_number()` in the
 * order of `compareLeaderboardEntries` — the board's ranking key, then the
 * run's own time, then the server's `recorded_at`, then the session id — so
 * ranks are unique and stable. The key is ascending on every board, which is
 * what lets one query serve a board that ranks by time and one that ranks by
 * the number of answers.
 */
export interface LeaderboardRepository {
  /**
   * The best players on a board, one run each, and how many there are.
   *
   * `among` narrows the board to a set of players — the player and their
   * friends. It is the same ranking over fewer rows, so a friends board
   * numbers places from 1 and counts only the players on it.
   */
  board(
    board: LeaderboardBoardId,
    limit: number,
    among?: readonly string[],
  ): Promise<{ players: number; runs: RankedPlace[] }>;
  /** The player's best run on a board, with its rank. */
  playerPlace(
    userId: string,
    board: LeaderboardBoardId,
  ): Promise<RankedPlace | null>;
  /** The player's best run on every board where they have one. */
  playerRecords(userId: string): Promise<PlayerRecord[]>;
  /** The score to beat for a player's next run on a board. */
  playerBest(
    userId: string,
    board: LeaderboardBoardId,
  ): Promise<RankedScore | null>;
}

export function createLeaderboardRepository(
  db: Database,
): LeaderboardRepository {
  /** Every player's best run on each board (or on one board). */
  const bestRuns = (board?: LeaderboardBoardId, among?: readonly string[]) =>
    db
      .selectDistinctOn([leaderboardRuns.board, leaderboardRuns.userId], {
        board: leaderboardRuns.board,
        userId: leaderboardRuns.userId,
        score: leaderboardRuns.score,
        timeMs: leaderboardRuns.timeMs,
        rankKey: leaderboardRuns.rankKey,
        recordedAt: leaderboardRuns.recordedAt,
        sessionId: leaderboardRuns.sessionId,
      })
      .from(leaderboardRuns)
      .where(
        and(
          board ? eq(leaderboardRuns.board, board) : undefined,
          among ? inArray(leaderboardRuns.userId, [...among]) : undefined,
        ),
      )
      .orderBy(
        leaderboardRuns.board,
        leaderboardRuns.userId,
        asc(leaderboardRuns.rankKey),
        asc(leaderboardRuns.timeMs),
        asc(leaderboardRuns.recordedAt),
        asc(leaderboardRuns.sessionId),
      )
      .as('best');

  /** The best runs with their rank and the number of players per board. */
  const rankedRuns = (
    board?: LeaderboardBoardId,
    among?: readonly string[],
  ) => {
    const best = bestRuns(board, among);
    return db
      .select({
        board: best.board,
        userId: best.userId,
        score: best.score,
        timeMs: best.timeMs,
        recordedAt: best.recordedAt,
        rank: sql<number>`row_number() over (partition by ${best.board} order by ${best.rankKey}, ${best.timeMs}, ${best.recordedAt}, ${best.sessionId})`
          .mapWith(Number)
          .as('rank'),
        players: sql<number>`count(*) over (partition by ${best.board})`
          .mapWith(Number)
          .as('players'),
      })
      .from(best)
      .as('ranked');
  };

  const toPlace = (row: {
    userId: string;
    nickname: string | null;
    rank: number;
    players: number;
    score: number;
    timeMs: number;
    recordedAt: Date;
  }): RankedPlace => ({ ...row, recordedAt: row.recordedAt.getTime() });

  return {
    async board(board, limit, among) {
      // Nobody at all is a board with no rows; `IN ()` is not valid SQL.
      if (among && among.length === 0) return { players: 0, runs: [] };
      const ranked = rankedRuns(board, among);
      const rows = await db
        .select({
          userId: ranked.userId,
          nickname: users.nickname,
          rank: ranked.rank,
          players: ranked.players,
          score: ranked.score,
          timeMs: ranked.timeMs,
          recordedAt: ranked.recordedAt,
        })
        .from(ranked)
        .innerJoin(users, eq(users.id, ranked.userId))
        .orderBy(asc(ranked.rank))
        .limit(limit);
      const [total] = await db
        .select({ players: count() })
        .from(bestRuns(board, among));
      return { players: total?.players ?? 0, runs: rows.map(toPlace) };
    },

    async playerPlace(userId, board) {
      const ranked = rankedRuns(board);
      const [row] = await db
        .select({
          userId: ranked.userId,
          nickname: users.nickname,
          rank: ranked.rank,
          players: ranked.players,
          score: ranked.score,
          timeMs: ranked.timeMs,
          recordedAt: ranked.recordedAt,
        })
        .from(ranked)
        .innerJoin(users, eq(users.id, ranked.userId))
        .where(eq(ranked.userId, userId))
        .limit(1);
      return row ? toPlace(row) : null;
    },

    async playerRecords(userId) {
      const ranked = rankedRuns();
      const rows = await db
        .select({
          board: ranked.board,
          userId: ranked.userId,
          nickname: users.nickname,
          rank: ranked.rank,
          players: ranked.players,
          score: ranked.score,
          timeMs: ranked.timeMs,
          recordedAt: ranked.recordedAt,
        })
        .from(ranked)
        .innerJoin(users, eq(users.id, ranked.userId))
        .where(eq(ranked.userId, userId))
        .orderBy(asc(ranked.board));
      return rows.map((row) => ({
        ...toPlace(row),
        board: row.board as LeaderboardBoardId,
      }));
    },

    async playerBest(userId, board) {
      const [row] = await db
        .select({
          score: leaderboardRuns.score,
          timeMs: leaderboardRuns.timeMs,
        })
        .from(leaderboardRuns)
        .where(
          and(
            eq(leaderboardRuns.userId, userId),
            eq(leaderboardRuns.board, board),
          ),
        )
        .orderBy(asc(leaderboardRuns.rankKey), asc(leaderboardRuns.timeMs))
        .limit(1);
      return row ? { value: row.score, timeMs: row.timeMs } : null;
    },
  };
}
