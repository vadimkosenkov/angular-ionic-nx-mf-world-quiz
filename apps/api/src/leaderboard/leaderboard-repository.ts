import type { LeaderboardBoardId } from '@world-quiz/quiz/domain';
import { and, asc, count, eq, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from '../db/database';
import { challenges, users } from '../db/schema';

/** A challenge as issued; the run fields are filled when it is played. */
export interface StoredChallenge {
  readonly id: string;
  readonly userId: string;
  readonly board: LeaderboardBoardId;
  readonly seed: string;
  readonly issuedAt: number;
  /** The session that played it, `null` while unplayed. */
  readonly sessionId: string | null;
}

export interface RankedRun {
  readonly userId: string;
  readonly nickname: string | null;
  readonly rank: number;
  readonly completionMs: number;
  readonly recordedAt: number;
}

export interface PlayerRecord {
  readonly board: LeaderboardBoardId;
  readonly rank: number;
  readonly players: number;
  readonly completionMs: number;
  readonly recordedAt: number;
}

/**
 * Challenges and rankings. Knows SQL, not quiz rules.
 *
 * A ranking is a query over ranked runs (docs/domain/leaderboard.md): each
 * player's best run (`DISTINCT ON`), numbered by `row_number()` in the order
 * of `compareLeaderboardEntries` — completion time, then the server's
 * `recorded_at`, then the session id — so ranks are unique and stable.
 */
export interface LeaderboardRepository {
  issueChallenge(challenge: Omit<StoredChallenge, 'sessionId'>): Promise<void>;
  findChallenge(id: string): Promise<StoredChallenge | null>;
  /** Deletes the player's challenges issued before `before` and never played. */
  deleteUnplayedChallenges(userId: string, before: number): Promise<void>;
  /** The fastest players on a board, one run each, and how many there are. */
  board(
    board: LeaderboardBoardId,
    limit: number,
  ): Promise<{ players: number; runs: RankedRun[] }>;
  /** The player's best ranked run on a board, with its rank. */
  playerRank(
    userId: string,
    board: LeaderboardBoardId,
  ): Promise<RankedRun | null>;
  /** The player's best ranked run on every board where they have one. */
  playerRecords(userId: string): Promise<PlayerRecord[]>;
}

export function createLeaderboardRepository(
  db: Database,
): LeaderboardRepository {
  /** Every player's best ranked run on each board (or on one board). */
  const bestRuns = (board?: LeaderboardBoardId) =>
    db
      .selectDistinctOn([challenges.board, challenges.userId], {
        board: challenges.board,
        userId: challenges.userId,
        completionMs: challenges.completionMs,
        recordedAt: challenges.recordedAt,
        sessionId: challenges.sessionId,
      })
      .from(challenges)
      .where(
        and(
          eq(challenges.outcome, 'ranked'),
          board ? eq(challenges.board, board) : undefined,
        ),
      )
      .orderBy(
        challenges.board,
        challenges.userId,
        asc(challenges.completionMs),
        asc(challenges.recordedAt),
        asc(challenges.sessionId),
      )
      .as('best');

  /** The best runs with their rank and the number of players per board. */
  const rankedRuns = (board?: LeaderboardBoardId) => {
    const best = bestRuns(board);
    return db
      .select({
        board: best.board,
        userId: best.userId,
        completionMs: best.completionMs,
        recordedAt: best.recordedAt,
        rank: sql<number>`row_number() over (partition by ${best.board} order by ${best.completionMs}, ${best.recordedAt}, ${best.sessionId})`
          .mapWith(Number)
          .as('rank'),
        players: sql<number>`count(*) over (partition by ${best.board})`
          .mapWith(Number)
          .as('players'),
      })
      .from(best)
      .as('ranked');
  };

  const toRun = (row: {
    userId: string;
    nickname: string | null;
    rank: number;
    completionMs: number | null;
    recordedAt: Date | null;
  }): RankedRun => ({
    userId: row.userId,
    nickname: row.nickname,
    rank: row.rank,
    completionMs: row.completionMs ?? 0,
    recordedAt: row.recordedAt?.getTime() ?? 0,
  });

  return {
    async issueChallenge(challenge) {
      await db.insert(challenges).values({
        id: challenge.id,
        userId: challenge.userId,
        board: challenge.board,
        seed: challenge.seed,
        issuedAt: new Date(challenge.issuedAt),
      });
    },

    async findChallenge(id) {
      const [row] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        board: row.board as LeaderboardBoardId,
        seed: row.seed,
        issuedAt: row.issuedAt.getTime(),
        sessionId: row.sessionId,
      };
    },

    async deleteUnplayedChallenges(userId, before) {
      await db
        .delete(challenges)
        .where(
          and(
            eq(challenges.userId, userId),
            isNull(challenges.sessionId),
            lt(challenges.issuedAt, new Date(before)),
          ),
        );
    },

    async board(board, limit) {
      const ranked = rankedRuns(board);
      const rows = await db
        .select({
          userId: ranked.userId,
          nickname: users.nickname,
          rank: ranked.rank,
          completionMs: ranked.completionMs,
          recordedAt: ranked.recordedAt,
        })
        .from(ranked)
        .innerJoin(users, eq(users.id, ranked.userId))
        .orderBy(asc(ranked.rank))
        .limit(limit);
      const [total] = await db
        .select({ players: count() })
        .from(bestRuns(board));
      return { players: total?.players ?? 0, runs: rows.map(toRun) };
    },

    async playerRank(userId, board) {
      const ranked = rankedRuns(board);
      const [row] = await db
        .select({
          userId: ranked.userId,
          nickname: users.nickname,
          rank: ranked.rank,
          completionMs: ranked.completionMs,
          recordedAt: ranked.recordedAt,
        })
        .from(ranked)
        .innerJoin(users, eq(users.id, ranked.userId))
        .where(eq(ranked.userId, userId))
        .limit(1);
      return row ? toRun(row) : null;
    },

    async playerRecords(userId) {
      const ranked = rankedRuns();
      const rows = await db
        .select({
          board: ranked.board,
          rank: ranked.rank,
          players: ranked.players,
          completionMs: ranked.completionMs,
          recordedAt: ranked.recordedAt,
        })
        .from(ranked)
        .where(eq(ranked.userId, userId))
        .orderBy(asc(ranked.board));
      return rows.map((row) => ({
        board: row.board as LeaderboardBoardId,
        rank: row.rank,
        players: row.players,
        completionMs: row.completionMs ?? 0,
        recordedAt: row.recordedAt?.getTime() ?? 0,
      }));
    },
  };
}
