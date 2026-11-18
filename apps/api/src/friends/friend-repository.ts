import { and, asc, eq, or, sql } from 'drizzle-orm';
import type { Database } from '../db/database';
import { friendships, users } from '../db/schema';

/** Another player, as the friends lists carry them. */
export interface FriendRow {
  readonly id: string;
  readonly nickname: string | null;
  /** When the friendship was agreed, or the request sent. */
  readonly since: number;
}

export interface FriendLists {
  readonly friends: FriendRow[];
  readonly incoming: FriendRow[];
  readonly outgoing: FriendRow[];
}

/** What asking someone left behind. */
export type FriendRequestOutcome =
  /** A request is waiting for them (or already was). */
  | 'requested'
  /** They had asked first, so the two requests met. */
  | 'accepted';

/**
 * Who knows whom. Knows SQL, not the rules of the screens above it.
 *
 * A relationship is one row in the direction it was asked in, so the two
 * players are always found by looking at both columns. Asking someone who
 * has already asked you accepts their row instead of adding a second one —
 * which is also what makes two simultaneous requests safe, because the
 * primary key leaves only one of them standing.
 */
export interface FriendRepository {
  findByInviteCode(code: string): Promise<FriendRow | null>;
  /** Sends (or re-sends) a request; accepts a reverse one if it exists. */
  request(
    requesterId: string,
    addresseeId: string,
    now: number,
  ): Promise<FriendRequestOutcome>;
  /** Accepts a request this player received; `false` if there is none. */
  accept(userId: string, otherId: string, now: number): Promise<boolean>;
  /** Removes the relationship in either direction and either state. */
  remove(userId: string, otherId: string): Promise<boolean>;
  lists(userId: string): Promise<FriendLists>;
  /** The ids of this player's friends, for the board they share. */
  friendIds(userId: string): Promise<string[]>;
  /** The friend, or `null` when these two are not friends. */
  friend(userId: string, otherId: string): Promise<FriendRow | null>;
}

export function createFriendRepository(db: Database): FriendRepository {
  const pairWhere = (a: string, b: string) =>
    or(
      and(eq(friendships.requesterId, a), eq(friendships.addresseeId, b)),
      and(eq(friendships.requesterId, b), eq(friendships.addresseeId, a)),
    );

  /** The other player's columns, whichever side of the row they are on. */
  const otherSide = (userId: string) =>
    sql<string>`case when ${friendships.requesterId} = ${userId} then ${friendships.addresseeId} else ${friendships.requesterId} end`;

  /**
   * When the row started counting: the day it was accepted for a
   * friendship, the day it was sent for a request that is still waiting.
   */
  const sinceColumn =
    sql<Date>`coalesce(${friendships.respondedAt}, ${friendships.requestedAt})`.mapWith(
      friendships.requestedAt,
    );

  const rowsOf = async (
    userId: string,
    condition: ReturnType<typeof and>,
  ): Promise<FriendRow[]> => {
    const other = otherSide(userId).as('other_id');
    const rows = await db
      .select({
        id: other,
        nickname: users.nickname,
        since: sinceColumn,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, otherSide(userId)))
      .where(condition)
      .orderBy(asc(users.nickname), asc(users.id));
    return rows.map((row) => ({
      id: row.id,
      nickname: row.nickname,
      since: row.since.getTime(),
    }));
  };

  /**
   * The state a request leaves behind, read first and written second: a row
   * that appeared in between is either this same request arriving twice or
   * the other player's, and looking again settles both.
   */
  const request = async (
    requesterId: string,
    addresseeId: string,
    now: number,
    attempt = 0,
  ): Promise<FriendRequestOutcome> => {
    const [existing] = await db
      .select({
        requesterId: friendships.requesterId,
        status: friendships.status,
      })
      .from(friendships)
      .where(pairWhere(requesterId, addresseeId))
      .limit(1);

    if (existing) {
      if (existing.status === 'accepted') return 'accepted';
      // They asked first, so this request is the answer to theirs.
      if (existing.requesterId === addresseeId) {
        await db
          .update(friendships)
          .set({ status: 'accepted', respondedAt: new Date(now) })
          .where(
            and(
              eq(friendships.requesterId, addresseeId),
              eq(friendships.addresseeId, requesterId),
              eq(friendships.status, 'pending'),
            ),
          );
        return 'accepted';
      }
      return 'requested';
    }

    const inserted = await db
      .insert(friendships)
      .values({
        requesterId,
        addresseeId,
        status: 'pending',
        requestedAt: new Date(now),
      })
      .onConflictDoNothing()
      .returning({ requesterId: friendships.requesterId });
    if (inserted.length > 0) return 'requested';
    return attempt === 0
      ? request(requesterId, addresseeId, now, 1)
      : 'requested';
  };

  return {
    async findByInviteCode(code) {
      const [row] = await db
        .select({
          id: users.id,
          nickname: users.nickname,
          since: users.createdAt,
        })
        .from(users)
        .where(eq(users.inviteCode, code))
        .limit(1);
      return row ? { ...row, since: row.since.getTime() } : null;
    },

    request,

    async accept(userId, otherId, now) {
      const updated = await db
        .update(friendships)
        .set({ status: 'accepted', respondedAt: new Date(now) })
        .where(
          and(
            eq(friendships.requesterId, otherId),
            eq(friendships.addresseeId, userId),
            eq(friendships.status, 'pending'),
          ),
        )
        .returning({ requesterId: friendships.requesterId });
      return updated.length > 0;
    },

    async remove(userId, otherId) {
      const deleted = await db
        .delete(friendships)
        .where(pairWhere(userId, otherId))
        .returning({ requesterId: friendships.requesterId });
      return deleted.length > 0;
    },

    async lists(userId) {
      const [friends, incoming, outgoing] = await Promise.all([
        rowsOf(
          userId,
          and(
            eq(friendships.status, 'accepted'),
            or(
              eq(friendships.requesterId, userId),
              eq(friendships.addresseeId, userId),
            ),
          ),
        ),
        rowsOf(
          userId,
          and(
            eq(friendships.status, 'pending'),
            eq(friendships.addresseeId, userId),
          ),
        ),
        rowsOf(
          userId,
          and(
            eq(friendships.status, 'pending'),
            eq(friendships.requesterId, userId),
          ),
        ),
      ]);
      return { friends, incoming, outgoing };
    },

    async friendIds(userId) {
      const other = otherSide(userId).as('other_id');
      const rows = await db
        .select({ id: other })
        .from(friendships)
        .where(
          and(
            eq(friendships.status, 'accepted'),
            or(
              eq(friendships.requesterId, userId),
              eq(friendships.addresseeId, userId),
            ),
          ),
        );
      return rows.map((row) => row.id);
    },

    async friend(userId, otherId) {
      const [row] = await db
        .select({
          id: users.id,
          nickname: users.nickname,
          since: sinceColumn,
        })
        .from(friendships)
        .innerJoin(users, eq(users.id, otherId))
        .where(
          and(eq(friendships.status, 'accepted'), pairWhere(userId, otherId)),
        )
        .limit(1);
      return row
        ? { id: row.id, nickname: row.nickname, since: row.since.getTime() }
        : null;
    },
  };
}
