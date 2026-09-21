import { err, ok, type Result } from '@world-quiz/shared/util';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Database } from '../db/database';
import { refreshTokens } from '../db/schema';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface IssuedRefreshToken {
  /** The only time the raw token exists outside the client. */
  readonly token: string;
  readonly expiresAt: number;
}

export type RefreshError =
  /** Unknown, expired, or its family was signed out. */
  | 'invalid'
  /** Already exchanged once: a copy is in use, so the family is revoked. */
  | 'reused';

export interface RefreshTokenStore {
  /** A new token, starting a new family (a new sign-in). */
  issue(userId: string, now: number): Promise<IssuedRefreshToken>;
  /** Exchanges a token for its successor in the same family. */
  rotate(
    token: string,
    now: number,
  ): Promise<
    Result<{ userId: string; next: IssuedRefreshToken }, RefreshError>
  >;
  /** Signs out the family the token belongs to. Unknown tokens are ignored. */
  revokeFamily(token: string, now: number): Promise<void>;
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

/**
 * Opaque, random refresh tokens (256 bits), stored only as SHA-256 hashes,
 * rotated on every use with reuse detection:
 *
 * 1. A refresh marks the presented token `used` and issues the next one in
 *    the same family.
 * 2. Presenting a `used` (or revoked) token again means someone holds a copy.
 *    The whole family is revoked, so both the thief and the user must sign in
 *    again, and the thief's copy is dead.
 */
export function createRefreshTokenStore(db: Database): RefreshTokenStore {
  const insert = async (
    executor: Pick<Database, 'insert'>,
    userId: string,
    familyId: string,
    now: number,
  ): Promise<IssuedRefreshToken> => {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + REFRESH_TOKEN_TTL_MS;
    await executor.insert(refreshTokens).values({
      userId,
      familyId,
      tokenHash: hash(token),
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
    });
    return { token, expiresAt };
  };

  const revokeFamilyById = (
    executor: Pick<Database, 'update'>,
    familyId: string,
    now: number,
  ) =>
    executor
      .update(refreshTokens)
      .set({ revokedAt: new Date(now) })
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          isNull(refreshTokens.revokedAt),
        ),
      );

  return {
    issue: (userId, now) => insert(db, userId, randomUUID(), now),

    async rotate(token, now) {
      const outcome = await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, hash(token)))
          // Two refreshes with the same token: the second waits, then sees it used.
          .for('update')
          .limit(1);

        if (!row) return err<RefreshError>('invalid');
        if (row.usedAt || row.revokedAt) {
          if (!row.revokedAt) await revokeFamilyById(tx, row.familyId, now);
          return err<RefreshError>(row.revokedAt ? 'invalid' : 'reused');
        }
        if (row.expiresAt.getTime() <= now) return err<RefreshError>('invalid');

        await tx
          .update(refreshTokens)
          .set({ usedAt: new Date(now) })
          .where(eq(refreshTokens.id, row.id));
        const next = await insert(tx, row.userId, row.familyId, now);
        return ok({ userId: row.userId, next });
      });
      return outcome;
    },

    async revokeFamily(token, now) {
      const [row] = await db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, hash(token)))
        .limit(1);
      if (row) await revokeFamilyById(db, row.familyId, now);
    },
  };
}
