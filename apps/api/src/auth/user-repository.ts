import type { User } from '@world-quiz/shared/contracts';
import { and, asc, eq, TransactionRollbackError } from 'drizzle-orm';
import type { Database } from '../db/database';
import { userIdentities, users } from '../db/schema';
import { defaultNickname } from './nickname';

/** A provider account, or the development pseudo-provider. */
export interface IdentityKey {
  readonly provider: 'google' | 'apple' | 'dev';
  readonly subject: string;
  readonly email: string | null;
}

export interface UserRepository {
  /**
   * The user signed in with this provider account, created on first sign-in.
   * `displayName` is only used when the user is created.
   */
  findOrCreate(
    identity: IdentityKey,
    displayName: string | null,
    now: number,
  ): Promise<User>;
  findById(id: string): Promise<User | null>;
  /** Sets the public name; `null` when the user no longer exists. */
  setNickname(id: string, nickname: string): Promise<User | null>;
  /** Deletes the user and, by cascade, everything the user owns. */
  delete(id: string): Promise<boolean>;
}

export function createUserRepository(db: Database): UserRepository {
  const findById = async (id: string): Promise<User | null> => {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) return null;
    const identities = await db
      .select({ provider: userIdentities.provider })
      .from(userIdentities)
      .where(eq(userIdentities.userId, id))
      .orderBy(asc(userIdentities.provider));
    return {
      id: user.id,
      displayName: user.displayName,
      nickname: user.nickname ?? defaultNickname(user.id),
      email: user.email,
      providers: identities.map(
        (identity) => identity.provider as User['providers'][number],
      ),
      createdAt: user.createdAt.toISOString(),
    };
  };

  const requireUser = async (id: string): Promise<User> => {
    const user = await findById(id);
    if (!user) throw new Error(`User ${id} vanished during sign-in`);
    return user;
  };

  const ownerOf = async (identity: IdentityKey) => {
    const [row] = await db
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, identity.provider),
          eq(userIdentities.subject, identity.subject),
        ),
      )
      .limit(1);
    return row?.userId ?? null;
  };

  return {
    findById,

    async setNickname(id, nickname) {
      const updated = await db
        .update(users)
        .set({ nickname })
        .where(eq(users.id, id))
        .returning({ id: users.id });
      return updated.length > 0 ? findById(id) : null;
    },

    async findOrCreate(identity, displayName, now) {
      const existing = await ownerOf(identity);
      if (existing) return requireUser(existing);

      let created: string | null;
      try {
        created = await db.transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({
              displayName,
              email: identity.email,
              createdAt: new Date(now),
            })
            .returning({ id: users.id });
          const linked = await tx
            .insert(userIdentities)
            .values({
              provider: identity.provider,
              subject: identity.subject,
              userId: user!.id,
              email: identity.email,
              createdAt: new Date(now),
            })
            .onConflictDoNothing()
            .returning({ userId: userIdentities.userId });
          // The same first sign-in arrived twice at once and the other one
          // linked the account first: undo this user, keep theirs.
          if (linked.length === 0) tx.rollback();
          return user!.id;
        });
      } catch (error) {
        if (!(error instanceof TransactionRollbackError)) throw error;
        created = null;
      }

      const userId = created ?? (await ownerOf(identity));
      if (!userId)
        throw new Error('Sign-in lost its account to a concurrent delete');
      return requireUser(userId);
    },

    async delete(id) {
      const deleted = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });
      return deleted.length > 0;
    },
  };
}
