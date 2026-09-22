import {
  challengeSchema,
  leaderboardSchema,
  myRecordsSchema,
  sessionResultSchema,
  type SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import {
  type LeaderboardBoardId,
  type LeaderboardEntry,
  type QuizConfig,
  rankLeaderboard,
} from '@world-quiz/quiz/domain';
import { count, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { defaultNickname } from '../auth/nickname';
import type { DatabaseHandle } from '../db/database';
import { challenges, quizSessions } from '../db/schema';
import { playSession } from '../testing/play-session';
import { createTestApi, TEST_START, type TestApi } from '../testing/test-api';
import { createTestDatabase } from '../testing/test-database';
import {
  CHALLENGE_LIFETIME_MS,
  CHALLENGE_TIME_TOLERANCE_MS,
} from './challenge-rules';

const challengeConfig = (
  board: LeaderboardBoardId = 'capitals-easy',
): QuizConfig => {
  const [category, difficulty] = board.split('-') as [
    QuizConfig['category'],
    QuizConfig['difficulty'],
  ];
  return { category, difficulty, mode: 'challenge', scope: 'world' };
};

describe('leaderboards', () => {
  let database: DatabaseHandle;
  let api: TestApi;
  let player: string;
  let playerId: string;
  /** The dev subject behind each bearer header, to sign in again. */
  const subjectOf = new Map<string, string>();
  const signIn = async (subject: string, displayName?: string) => {
    const signedIn = await api.signIn(subject, displayName);
    subjectOf.set(signedIn.authorization, subject);
    return signedIn;
  };

  const as = (authorization: string) => ({
    post: (path: string, body: object) =>
      request(api.app)
        .post(path)
        .set('Authorization', authorization)
        .send(body),
    get: (path: string) =>
      request(api.app).get(path).set('Authorization', authorization),
    patch: (path: string, body: object) =>
      request(api.app)
        .patch(path)
        .set('Authorization', authorization)
        .send(body),
  });

  const startChallenge = async (
    authorization = player,
    board: LeaderboardBoardId = 'capitals-easy',
  ) => {
    const response = await as(authorization).post('/v1/challenges', { board });
    expect(response.status).toBe(201);
    return challengeSchema.parse(response.body);
  };

  /**
   * Plays a challenge the way the app does: it starts right after the
   * challenge is issued, answers one question per second, and the result is
   * received `sentAfterMs` after the last answer.
   */
  const playChallenge = async (
    challenge: { id: string; seed: string; board: LeaderboardBoardId },
    {
      authorization = player,
      wrong = new Set<number>(),
      step = 1_000,
      startDelayMs = 2_000,
      sentAfterMs = 500,
      override = {} as Partial<SubmitSessionRequest>,
    } = {},
  ) => {
    let bearer = authorization;
    const startedAt = api.clock.now() + startDelayMs;
    const session = {
      ...playSession(api.engine, challengeConfig(challenge.board), {
        seed: challenge.seed,
        startedAt,
        step,
        wrong,
      }),
      challengeId: challenge.id,
      ...override,
    };
    api.clock.set(session.finishedAt + sentAfterMs);
    if (sentAfterMs > 10 * 60 * 1000) {
      // Access tokens last 15 minutes: the app would have renewed it.
      bearer = (await api.signIn(subjectOf.get(authorization))).authorization;
    }
    const response = await as(bearer).post('/v1/sessions', session);
    return { session, response };
  };

  const board = async (board: LeaderboardBoardId = 'capitals-easy') =>
    leaderboardSchema.parse(
      (await request(api.app).get(`/v1/leaderboards/${board}`)).body,
    );

  beforeAll(async () => {
    database = await createTestDatabase();
    api = await createTestApi(database);
  });

  beforeEach(async () => {
    api.clock.set(TEST_START + 60_000);
    ({ authorization: player, userId: playerId } = await signIn('player-1'));
  });

  afterEach(async () => {
    await database.db.execute(sql`TRUNCATE users CASCADE`);
  });

  afterAll(async () => {
    await database.close();
  });

  describe('POST /v1/challenges', () => {
    it('issues a challenge with a fresh server seed, playable for three hours', async () => {
      const first = await startChallenge();
      const second = await startChallenge();

      expect(first.seed).not.toBe(second.seed);
      expect(first.seed).toMatch(/^[\w-]{22}$/);
      expect(Date.parse(first.expiresAt) - Date.parse(first.issuedAt)).toBe(
        CHALLENGE_LIFETIME_MS,
      );
    });

    it('needs a signed-in player and a real board', async () => {
      expect(
        (
          await request(api.app)
            .post('/v1/challenges')
            .send({ board: 'capitals-easy' })
        ).status,
      ).toBe(401);
      expect(
        (await as(player).post('/v1/challenges', { board: 'capitals-europe' }))
          .status,
      ).toBe(400);
    });

    it("clears the player's own challenges that can no longer be played", async () => {
      await startChallenge();
      const { authorization: other } = await api.signIn('player-2');
      await startChallenge(other);

      api.clock.advance(CHALLENGE_LIFETIME_MS + 1);
      await startChallenge((await signIn('player-1')).authorization);

      const left = await database.db
        .select({ n: count() })
        .from(challenges)
        .where(eq(challenges.userId, playerId));
      expect(left[0]?.n).toBe(1);
      const total = await database.db.select({ n: count() }).from(challenges);
      expect(total[0]?.n).toBe(2);
    });
  });

  describe('recording a challenge run', () => {
    it('ranks a perfect run by its own time and reports rank and record', async () => {
      const challenge = await startChallenge();

      const { session, response } = await playChallenge(challenge);

      expect(response.status).toBe(201);
      const { challenge: outcome } = sessionResultSchema.parse(response.body);
      expect(outcome).toEqual({
        board: 'capitals-easy',
        ranked: true,
        completionTimeMs: session.finishedAt - session.startedAt,
        personalRecord: true,
        rank: 1,
      });
      expect((await board()).entries).toEqual([
        {
          rank: 1,
          nickname: defaultNickname(playerId),
          completionTimeMs: session.finishedAt - session.startedAt,
          recordedAt: new Date(api.clock.now()).toISOString(),
        },
      ]);
    });

    it.each([
      ['has-incorrect-answers', { wrong: new Set([3]) }],
      ['late', { sentAfterMs: CHALLENGE_TIME_TOLERANCE_MS + 1_000 }],
      ['late', { startDelayMs: CHALLENGE_TIME_TOLERANCE_MS + 1_000 }],
      ['implausible-time', { startDelayMs: -30_000 }],
      ['expired', { sentAfterMs: CHALLENGE_LIFETIME_MS }],
    ] as const)(
      'records but does not rank a run that is %s',
      async (reason, options) => {
        const challenge = await startChallenge();

        const { response } = await playChallenge(challenge, options);

        expect(response.status).toBe(201);
        expect(response.body.challenge).toMatchObject({
          ranked: false,
          reason,
          personalRecord: false,
          rank: null,
        });
        expect((await board()).players).toBe(0);
      },
    );

    it('answers a retry with the same outcome, and refuses a second session for the challenge', async () => {
      const challenge = await startChallenge();
      const { session, response } = await playChallenge(challenge);

      const retry = await as(player).post('/v1/sessions', session);
      const another = await as(player).post('/v1/sessions', {
        ...session,
        id: crypto.randomUUID(),
      });

      expect(retry.status).toBe(200);
      expect(retry.body.challenge).toEqual(response.body.challenge);
      expect(another.status).toBe(422);
      expect(another.body.type).toBe(
        'urn:world-quiz:session-rejected:challenge-used',
      );
    });

    it.each([
      ['challenge-missing', { challengeId: undefined }],
      ['unknown-challenge', { challengeId: crypto.randomUUID() }],
      ['challenge-mismatch', { seed: 'not-the-challenge-seed' }],
    ] as const)('rejects a run with %s', async (reason, override) => {
      const challenge = await startChallenge();

      const { response } = await playChallenge(challenge, {
        override: override as Partial<SubmitSessionRequest>,
      });

      expect(response.status).toBe(422);
      expect(response.body.type).toBe(
        `urn:world-quiz:session-rejected:${reason}`,
      );
    });

    it("rejects a run on another board, or on another player's challenge", async () => {
      const easy = await startChallenge(player, 'capitals-easy');
      const { authorization: other } = await api.signIn('player-2');
      const theirs = await startChallenge(other);

      const wrongBoard = await playChallenge(
        { ...easy, board: 'flags-easy' },
        {},
      );
      const stolen = await playChallenge(theirs);

      expect(wrongBoard.response.body.type).toBe(
        'urn:world-quiz:session-rejected:challenge-mismatch',
      );
      expect(stolen.response.body.type).toBe(
        'urn:world-quiz:session-rejected:unknown-challenge',
      );
    });

    it('rejects a challenge id on a training session', async () => {
      const challenge = await startChallenge();
      const training = {
        ...playSession(api.engine, {
          category: 'capitals',
          difficulty: 'easy',
          mode: 'fixed',
          scope: 'europe',
          questionCount: 2,
        }),
        challengeId: challenge.id,
      };

      const response = await as(player).post('/v1/sessions', training);

      expect(response.body.type).toBe(
        'urn:world-quiz:session-rejected:not-a-challenge',
      );
    });
  });

  describe('rankings', () => {
    it('keeps each player once, with their best run, fastest first', async () => {
      const { authorization: bob } = await signIn('player-2', 'Bob');
      await as(bob).patch('/v1/me', { nickname: 'Bob the Quick' });

      await playChallenge(await startChallenge(player), { step: 1_500 });
      await playChallenge(await startChallenge(bob), {
        authorization: bob,
        step: 1_200,
      });
      const faster = await playChallenge(await startChallenge(player), {
        step: 1_000,
      });
      const slower = await playChallenge(await startChallenge(player), {
        step: 2_000,
      });

      expect(faster.response.body.challenge).toMatchObject({
        personalRecord: true,
        rank: 1,
      });
      expect(slower.response.body.challenge).toMatchObject({
        ranked: true,
        personalRecord: false,
        rank: 1,
      });
      const ranking = await board();
      expect(ranking.players).toBe(2);
      expect(ranking.entries.map((entry) => entry.nickname)).toEqual([
        defaultNickname(playerId),
        'Bob the Quick',
      ]);
    });

    it('orders exactly as the domain ranks, ties broken by recording time', async () => {
      // Runs written straight to the tables: many players, equal times.
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < 12; i++) {
        const { userId } = await api.signIn(`ranked-${i}`);
        for (let run = 0; run < 2; run++) {
          const entry: LeaderboardEntry = {
            entryId: crypto.randomUUID(),
            userId,
            boardId: 'flags-hard',
            completionTimeMs: 60_000 + ((i * 7 + run * 3) % 5) * 1_000,
            recordedAt: TEST_START + ((i * 5 + run) % 4) * 1_000,
          };
          entries.push(entry);
          await insertRankedRun(database, entry);
        }
      }

      const ranking = await board('flags-hard');
      const expected = rankLeaderboard(entries, 'flags-hard');

      expect(ranking.players).toBe(12);
      expect(ranking.entries.map((entry) => entry.rank)).toEqual(
        expected.map((entry) => entry.rank),
      );
      expect(
        ranking.entries.map((entry) => [
          entry.completionTimeMs,
          entry.recordedAt,
        ]),
      ).toEqual(
        expected.map((entry) => [
          entry.completionTimeMs,
          new Date(entry.recordedAt).toISOString(),
        ]),
      );
    });

    it('is public, cacheable briefly, and limited on request', async () => {
      await playChallenge(await startChallenge());
      const { authorization: bob } = await signIn('player-2');
      await playChallenge(await startChallenge(bob), { authorization: bob });

      const response = await request(api.app).get(
        '/v1/leaderboards/capitals-easy?limit=1',
      );

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=30');
      expect(response.body.players).toBe(2);
      expect(response.body.entries).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toContain(playerId);
      expect(
        (await request(api.app).get('/v1/leaderboards/capitals-europe')).status,
      ).toBe(404);
      expect(
        (await request(api.app).get('/v1/leaderboards/capitals-easy?limit=0'))
          .status,
      ).toBe(400);
    });
  });

  describe('/v1/me', () => {
    it("lists the player's records per board with rank and field size", async () => {
      expect((await as(player).get('/v1/me/records')).body).toEqual({
        records: [],
      });
      const { authorization: bob } = await signIn('player-2');
      await playChallenge(await startChallenge(bob), {
        authorization: bob,
        step: 900,
      });
      const run = await playChallenge(await startChallenge());

      const records = myRecordsSchema.parse(
        (await as(player).get('/v1/me/records')).body,
      );

      expect(records.records).toEqual([
        {
          board: 'capitals-easy',
          rank: 2,
          players: 2,
          completionTimeMs: run.session.finishedAt - run.session.startedAt,
          recordedAt: expect.any(String),
        },
      ]);
    });

    it('sets a valid nickname and refuses anything else', async () => {
      const set = await as(player).patch('/v1/me', {
        nickname: '  Мария  ',
      });
      const invalid = await as(player).patch('/v1/me', {
        nickname: '<b>x</b>',
      });
      const extra = await as(player).patch('/v1/me', {
        nickname: 'Maria',
        email: 'x@example.com',
      });

      expect(set.status).toBe(200);
      expect(set.body.nickname).toBe('Мария');
      expect((await as(player).get('/v1/me')).body.nickname).toBe('Мария');
      expect(invalid.status).toBe(400);
      expect(extra.status).toBe(400);
    });

    it('gives every player a stable default nickname, never the provider name', async () => {
      const { authorization } = await api.signIn('named', 'Real Name');

      const me = await as(authorization).get('/v1/me');

      expect(me.body.displayName).toBe('Real Name');
      expect(me.body.nickname).toMatch(/^Player \d{4}$/);
    });
  });
});

/** A ranked challenge run written directly: a session row and its challenge. */
async function insertRankedRun(
  database: DatabaseHandle,
  entry: LeaderboardEntry,
) {
  const recordedAt = new Date(entry.recordedAt);
  await database.db.insert(quizSessions).values({
    id: entry.entryId,
    userId: entry.userId,
    category: 'flags',
    difficulty: 'hard',
    mode: 'challenge',
    scope: 'world',
    config: {
      category: 'flags',
      difficulty: 'hard',
      mode: 'challenge',
      scope: 'world',
    },
    seed: 'seed',
    startedAt: recordedAt,
    finishedAt: recordedAt,
    endReason: 'completed',
    answered: 0,
    correct: 0,
    durationMs: entry.completionTimeMs,
    completed: true,
    perfect: true,
    requestHash: 'hash',
    recordedAt,
  });
  await database.db.insert(challenges).values({
    id: crypto.randomUUID(),
    userId: entry.userId,
    board: entry.boardId,
    seed: 'seed',
    issuedAt: recordedAt,
    sessionId: entry.entryId,
    outcome: 'ranked',
    completionMs: entry.completionTimeMs,
    recordedAt,
    personalRecord: false,
  });
}
