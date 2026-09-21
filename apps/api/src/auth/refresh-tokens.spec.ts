import { eq } from 'drizzle-orm';
import type { DatabaseHandle } from '../db/database';
import { refreshTokens, users } from '../db/schema';
import { createTestDatabase } from '../testing/test-database';
import {
  createRefreshTokenStore,
  REFRESH_TOKEN_TTL_MS,
  type RefreshTokenStore,
} from './refresh-tokens';

const NOW = 1_700_000_000_000;

describe('refresh tokens', () => {
  let database: DatabaseHandle;
  let store: RefreshTokenStore;
  let userId: string;

  beforeAll(async () => {
    database = await createTestDatabase();
    store = createRefreshTokenStore(database.db);
    const [user] = await database.db
      .insert(users)
      .values({ displayName: 'Ann' })
      .returning({ id: users.id });
    userId = user!.id;
  });

  afterAll(async () => {
    await database.close();
  });

  it('are random and stored only as hashes', async () => {
    const { token } = await store.issue(userId, NOW);

    expect(token).toMatch(/^[\w-]{43}$/);
    const rows = await database.db
      .select({ tokenHash: refreshTokens.tokenHash })
      .from(refreshTokens);
    expect(rows.map((row) => row.tokenHash)).not.toContain(token);
  });

  it('rotate: each use returns a successor and retires the used token', async () => {
    const first = await store.issue(userId, NOW);

    const second = await store.rotate(first.token, NOW + 1_000);
    expect(second.ok && second.value.userId).toBe(userId);
    if (!second.ok) return;

    const third = await store.rotate(second.value.next.token, NOW + 2_000);
    expect(third.ok).toBe(true);
  });

  it('detect reuse: an old token presented again revokes the whole family', async () => {
    const first = await store.issue(userId, NOW);
    const rotated = await store.rotate(first.token, NOW + 1_000);
    if (!rotated.ok) throw new Error('rotation failed');

    // An attacker replays the stolen first token.
    expect(await store.rotate(first.token, NOW + 2_000)).toEqual({
      ok: false,
      error: 'reused',
    });
    // The legitimate successor is dead too: both must sign in again.
    expect(await store.rotate(rotated.value.next.token, NOW + 3_000)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('refuse unknown and expired tokens', async () => {
    expect(await store.rotate('not-a-token-that-was-ever-issued', NOW)).toEqual(
      {
        ok: false,
        error: 'invalid',
      },
    );

    const { token } = await store.issue(userId, NOW);
    expect(await store.rotate(token, NOW + REFRESH_TOKEN_TTL_MS)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('sign out revokes the family and leaves other sign-ins alone', async () => {
    const phone = await store.issue(userId, NOW);
    const laptop = await store.issue(userId, NOW);

    await store.revokeFamily(phone.token, NOW + 1_000);

    expect((await store.rotate(phone.token, NOW + 2_000)).ok).toBe(false);
    expect((await store.rotate(laptop.token, NOW + 2_000)).ok).toBe(true);
  });

  it('are deleted with their user', async () => {
    const [other] = await database.db
      .insert(users)
      .values({})
      .returning({ id: users.id });
    await store.issue(other!.id, NOW);

    await database.db.delete(users).where(eq(users.id, other!.id));

    const left = await database.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, other!.id));
    expect(left).toEqual([]);
  });
});
