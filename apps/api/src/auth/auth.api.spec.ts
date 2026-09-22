import { count, eq } from 'drizzle-orm';
import request from 'supertest';
import type { DatabaseHandle } from '../db/database';
import { quizSessions, users } from '../db/schema';
import { createTestApi, type TestApi } from '../testing/test-api';
import { createTestDatabase } from '../testing/test-database';
import { playSession } from '../testing/play-session';

/** The `wq_refresh` cookie pair from a response, for the next request. */
function refreshCookie(response: request.Response): string {
  const cookies = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  const cookie = cookies.find((value) => value.startsWith('wq_refresh='));
  if (!cookie) throw new Error('No refresh cookie in the response');
  return cookie.split(';')[0] as string;
}

describe('/v1/auth and /v1/me', () => {
  let database: DatabaseHandle;
  let api: TestApi;

  beforeAll(async () => {
    database = await createTestDatabase();
    api = await createTestApi(database);
  });

  afterAll(async () => {
    await database.close();
  });

  const signInWithGoogle = async (body: Record<string, unknown> = {}) =>
    request(api.app)
      .post('/v1/auth/google')
      .send({
        idToken: await api.provider.issue('google', {
          sub: 'google-ann',
          email: 'ann@example.com',
          email_verified: true,
        }),
        ...body,
      });

  describe('signing in', () => {
    it('with Google: web clients get the refresh token only as an httpOnly cookie', async () => {
      const response = await signInWithGoogle();

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.body).toMatchObject({
        user: { email: 'ann@example.com', providers: ['google'] },
        accessTokenExpiresAt: new Date(
          api.clock.now() + 15 * 60_000,
        ).toISOString(),
      });
      expect(response.body.refreshToken).toBeUndefined();

      const cookie = ([] as string[])
        .concat(response.headers['set-cookie'] ?? [])
        .find((value) => value.startsWith('wq_refresh='));
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/v1\/auth/);
      expect(cookie).toMatch(/Secure/);
    });

    it('signs the same provider account into the same user every time', async () => {
      const first = await signInWithGoogle();
      const second = await signInWithGoogle();

      expect(second.body.user.id).toBe(first.body.user.id);
    });

    it('with Apple: native clients get the refresh token in the body', async () => {
      const response = await request(api.app)
        .post('/v1/auth/apple')
        .send({
          idToken: await api.provider.issue('apple', { sub: 'apple-bob' }),
          displayName: 'Bob',
          refreshTokenIn: 'body',
        });

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        displayName: 'Bob',
        providers: ['apple'],
      });
      expect(response.body.refreshToken).toEqual(expect.any(String));
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('refuses a forged token with a vague 401', async () => {
      const response = await request(api.app)
        .post('/v1/auth/google')
        .send({
          idToken: await api.provider.issue(
            'google',
            {},
            { signedByStranger: true },
          ),
        });

      expect(response.status).toBe(401);
      expect(response.body.detail).toBe(
        'The identity token could not be verified.',
      );
    });

    it('answers 503 for a provider that is not configured', async () => {
      const googleOnly = await createTestApi(database, {}, ['google']);

      const response = await request(googleOnly.app)
        .post('/v1/auth/apple')
        .send({ idToken: await googleOnly.provider.issue('apple') });

      expect(response.status).toBe(503);
      expect(response.body.title).toBe('Sign-in provider unavailable');
    });

    it('rejects a body that breaks the contract', async () => {
      const response = await request(api.app)
        .post('/v1/auth/google')
        .send({ idToken: 'not-a-jwt', userId: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.errors.map((e: { path: string }) => e.path)).toEqual(
        expect.arrayContaining(['idToken', '']),
      );
    });
  });

  describe('refreshing', () => {
    it('rotates the cookie and refuses a replayed one, signing everyone out', async () => {
      const signIn = await signInWithGoogle();
      const original = refreshCookie(signIn);

      const refreshed = await request(api.app)
        .post('/v1/auth/refresh')
        .set('Cookie', original);
      expect(refreshed.status).toBe(200);
      const rotated = refreshCookie(refreshed);
      expect(rotated).not.toBe(original);

      // The copied original is used again: reuse detected.
      const replay = await request(api.app)
        .post('/v1/auth/refresh')
        .set('Cookie', original);
      expect(replay.status).toBe(401);
      expect(String(replay.headers['set-cookie'])).toMatch(/wq_refresh=;/);

      // …and the rotated token of that family is revoked with it.
      expect(
        (await request(api.app).post('/v1/auth/refresh').set('Cookie', rotated))
          .status,
      ).toBe(401);
    });

    it('accepts the token from the body for native clients', async () => {
      const signIn = await request(api.app)
        .post('/v1/auth/dev')
        .send({ subject: 'native-1', refreshTokenIn: 'body' });

      const refreshed = await request(api.app).post('/v1/auth/refresh').send({
        refreshToken: signIn.body.refreshToken,
        refreshTokenIn: 'body',
      });

      expect(refreshed.status).toBe(200);
      expect(refreshed.body.refreshToken).not.toBe(signIn.body.refreshToken);
    });

    it('answers 401 without any refresh token', async () => {
      expect((await request(api.app).post('/v1/auth/refresh')).status).toBe(
        401,
      );
    });
  });

  describe('signing out and deleting the account', () => {
    it('signing out revokes the refresh token and clears the cookie', async () => {
      const cookie = refreshCookie(await signInWithGoogle());

      const out = await request(api.app)
        .post('/v1/auth/logout')
        .set('Cookie', cookie);
      expect(out.status).toBe(204);
      expect(String(out.headers['set-cookie'])).toMatch(/wq_refresh=;/);

      expect(
        (await request(api.app).post('/v1/auth/refresh').set('Cookie', cookie))
          .status,
      ).toBe(401);
    });

    it('GET /v1/me needs a bearer token and returns the user', async () => {
      const { authorization, userId } = await api.signIn('me-1');

      expect((await request(api.app).get('/v1/me')).status).toBe(401);
      const me = await request(api.app)
        .get('/v1/me')
        .set('Authorization', authorization);
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ id: userId, providers: ['dev'] });
    });

    it('DELETE /v1/me deletes the user with every session and token', async () => {
      const { authorization, userId } = await api.signIn('leaving-1');
      const session = playSession(api.engine, {
        category: 'capitals',
        difficulty: 'easy',
        mode: 'fixed',
        scope: 'europe',
        questionCount: 2,
      });
      await request(api.app)
        .post('/v1/sessions')
        .set('Authorization', authorization)
        .send(session);

      const deleted = await request(api.app)
        .delete('/v1/me')
        .set('Authorization', authorization);
      expect(deleted.status).toBe(204);

      const [left] = await database.db
        .select({ sessions: count() })
        .from(quizSessions)
        .where(eq(quizSessions.userId, userId));
      expect(left?.sessions).toBe(0);
      expect(
        await database.db.select().from(users).where(eq(users.id, userId)),
      ).toEqual([]);
      expect(
        (
          await request(api.app)
            .get('/v1/me')
            .set('Authorization', authorization)
        ).status,
      ).toBe(401);
    });
  });

  describe('concurrency (meaningful on PostgreSQL; PGlite runs queries one at a time)', () => {
    it('two first sign-ins with the same account at once create one user', async () => {
      const idToken = await api.provider.issue('google', {
        sub: 'google-race',
      });
      const signIn = () =>
        request(api.app).post('/v1/auth/google').send({ idToken });

      const [a, b] = await Promise.all([signIn(), signIn()]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect(a.body.user.id).toBe(b.body.user.id);
    });

    it('two refreshes with the same token at once: exactly one succeeds', async () => {
      const cookie = refreshCookie(await signInWithGoogle());
      const refresh = () =>
        request(api.app).post('/v1/auth/refresh').set('Cookie', cookie);

      const statuses = (await Promise.all([refresh(), refresh()]))
        .map((response) => response.status)
        .sort();

      // The loser presents a token that was just used, which is exactly what
      // reuse looks like: the family is revoked. Clients serialise refreshes.
      expect(statuses).toEqual([200, 401]);
    });
  });

  describe('protection', () => {
    it('rate-limits the sign-in endpoints per client', async () => {
      const limited = await createTestApi(database, { authRateLimit: 2 });
      const attempt = () =>
        request(limited.app).post('/v1/auth/google').send({ idToken: 'a.b.c' });

      expect((await attempt()).status).toBe(401);
      expect((await attempt()).status).toBe(401);
      const blocked = await attempt();
      expect(blocked.status).toBe(429);
      expect(blocked.headers['content-type']).toMatch(
        /^application\/problem\+json/,
      );
    });

    it('has no development sign-in unless enabled', async () => {
      const production = await createTestApi(database, { devLogin: false });

      expect(
        (
          await request(production.app)
            .post('/v1/auth/dev')
            .send({ subject: 'x' })
        ).status,
      ).toBe(404);
    });

    it('allows credentials only for listed browser origins', async () => {
      const allowed = await request(api.app)
        .options('/v1/auth/refresh')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'POST');
      expect(allowed.status).toBe(204);
      expect(allowed.headers['access-control-allow-origin']).toBe(
        'http://localhost:4200',
      );
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');

      const foreign = await request(api.app)
        .post('/v1/auth/refresh')
        .set('Origin', 'https://evil.example');
      expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows every method the API uses from the web app', async () => {
      // Browsers check the method in a preflight; supertest never sends one.
      const preflight = await request(api.app)
        .options('/v1/me')
        .set('Origin', 'http://localhost:4200')
        .set('Access-Control-Request-Method', 'PATCH');

      const methods = preflight.headers['access-control-allow-methods'];
      for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
        expect(methods).toContain(method);
      }
    });
  });
});
