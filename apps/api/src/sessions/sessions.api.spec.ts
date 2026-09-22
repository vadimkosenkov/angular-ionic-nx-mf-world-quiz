import {
  type SessionHistoryEntry,
  sessionHistoryPageSchema,
  type SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import {
  createQuizEngine,
  type ProgressEvent,
  type QuizConfig,
  rebuildProgress,
  sessionProgressEvents,
} from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { count, sql } from 'drizzle-orm';
import request from 'supertest';
import type { DatabaseHandle } from '../db/database';
import { quizSessions } from '../db/schema';
import { readAnswers } from '../testing/read-answers';
import { createTestApi, TEST_START, type TestApi } from '../testing/test-api';
import { createTestDatabase } from '../testing/test-database';
import { playSession } from '../testing/play-session';
import { HISTORY_SETTLE_MS, MAX_CLOCK_SKEW_MS } from './session-service';

const engine = createQuizEngine(FIXTURE_DATASET);
const START = TEST_START;

const easyFixed: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'europe',
  questionCount: 3,
};

describe('/v1/sessions', () => {
  let database: DatabaseHandle;
  let api: TestApi;
  /** `Authorization` header of the signed-in test player. */
  let player: string;

  const post = (body: unknown, authorization = player) =>
    request(api.app)
      .post('/v1/sessions')
      .set('Authorization', authorization)
      .send(body as object);

  const get = (path: string, authorization = player) =>
    request(api.app).get(path).set('Authorization', authorization);

  beforeAll(async () => {
    database = await createTestDatabase();
    api = await createTestApi(database);
    ({ authorization: player } = await api.signIn('player-1'));
  });

  beforeEach(() => {
    api.clock.set(START + 60_000);
  });

  afterEach(async () => {
    await database.db.execute(sql`TRUNCATE quiz_sessions CASCADE`);
  });

  afterAll(async () => {
    await database.close();
  });

  describe('who may record and read', () => {
    it('requires a signed-in player', async () => {
      const session = playSession(engine, easyFixed);

      const response = await request(api.app)
        .post('/v1/sessions')
        .send(session);

      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(
        (await get(`/v1/sessions/${session.id}`, 'Bearer x.y.z')).status,
      ).toBe(401);
    });

    it('hides a session from other players, and refuses its id to them', async () => {
      const session = playSession(engine, easyFixed);
      await post(session);
      const { authorization: other } = await api.signIn('player-2');

      expect((await get(`/v1/sessions/${session.id}`, other)).status).toBe(404);
      expect((await post(session, other)).status).toBe(409);
      expect((await get(`/v1/sessions/${session.id}`)).status).toBe(200);
    });

    it('answers 401 when the account was deleted but the access token is still valid', async () => {
      const { authorization: doomed } = await api.signIn('player-to-delete');
      await request(api.app).delete('/v1/me').set('Authorization', doomed);

      const response = await post(playSession(engine, easyFixed), doomed);

      expect(response.status).toBe(401);
      expect(response.body.detail).toBe('This account no longer exists.');
    });
  });

  describe('POST', () => {
    it('grades a finished session itself and stores it', async () => {
      const session = playSession(engine, easyFixed, { wrong: new Set([1]) });

      const response = await post(session);

      expect(response.status).toBe(201);
      expect(response.headers['location']).toBe(`/v1/sessions/${session.id}`);
      expect(response.body).toEqual({
        id: session.id,
        config: easyFixed,
        summary: {
          answered: 3,
          correct: 2,
          incorrect: 1,
          accuracy: 2 / 3,
          durationMs: 3_000,
          endReason: 'completed',
          completed: true,
          perfect: false,
        },
        recordedAt: new Date(START + 60_000).toISOString(),
      });

      const answers = await readAnswers(database.db, session.id);
      expect(answers.map((answer) => answer.correct)).toEqual([
        true,
        false,
        true,
      ]);
    });

    it('is idempotent: a retry returns the stored result, not a second session', async () => {
      const session = playSession(engine, easyFixed);

      const first = await post(session);
      api.clock.advance(5_000);
      const retry = await post(session);

      expect(first.status).toBe(201);
      expect(retry.status).toBe(200);
      expect(retry.body).toEqual(first.body);
      const [row] = await database.db
        .select({ sessions: count() })
        .from(quizSessions);
      expect(row?.sessions).toBe(1);
    });

    it('records two identical requests that race each other exactly once', async () => {
      const session = playSession(engine, easyFixed);

      const responses = await Promise.all([post(session), post(session)]);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 201,
      ]);
      const [row] = await database.db
        .select({ sessions: count() })
        .from(quizSessions);
      expect(row?.sessions).toBe(1);
    });

    it('treats the same data with keys in another order as the same session', async () => {
      const session = playSession(engine, easyFixed);
      await post(session);

      const reordered = Object.fromEntries(Object.entries(session).reverse());
      expect((await post(reordered)).status).toBe(200);
    });

    it('treats an id in upper case as the same session', async () => {
      const session = playSession(engine, easyFixed);
      const created = await post({ ...session, id: session.id.toUpperCase() });

      expect(created.status).toBe(201);
      expect(created.body.id).toBe(session.id);
      expect(created.headers['location']).toBe(`/v1/sessions/${session.id}`);
      expect((await post(session)).status).toBe(200);
      expect(
        (await get(`/v1/sessions/${session.id.toUpperCase()}`)).body,
      ).toEqual(created.body);
    });

    it('refuses a different session under an id that is already used', async () => {
      const session = playSession(engine, easyFixed);
      await post(session);

      const other = playSession(engine, easyFixed, {
        id: session.id,
        seed: 'another-seed',
      });
      const response = await post(other);

      expect(response.status).toBe(409);
      expect(response.body.title).toBe('Session id already used');
    });

    it('stores an Endless session that was stopped by the player', async () => {
      const endless = playSession(
        engine,
        {
          category: 'flags',
          difficulty: 'easy',
          mode: 'endless',
          scope: 'world',
        },
        { answers: 4 },
      );

      const response = await post({
        ...endless,
        finishedAt: endless.finishedAt + 500,
      });

      expect(response.status).toBe(201);
      expect(response.body.summary).toMatchObject({
        answered: 4,
        endReason: 'stopped',
        completed: false,
        durationMs: 4_500,
      });
    });

    describe('never trusts what the client claims', () => {
      it('grades a wrong choice as wrong: correctness is not part of the request', async () => {
        const session = playSession(engine, easyFixed, {
          wrong: new Set([0, 2]),
        });

        const response = await post(session);

        expect(response.body.summary).toMatchObject({
          correct: 1,
          perfect: false,
        });
      });

      it.each([
        [
          'a choice that was never offered',
          (s: SubmitSessionRequest): SubmitSessionRequest => ({
            ...s,
            submissions: [
              {
                answer: { kind: 'choice', countryCode: 'zz' },
                answeredAt: s.startedAt + 1,
              },
            ],
            finishedAt: s.startedAt + 1,
            endReason: 'stopped',
          }),
          'invalid-submission',
        ],
        [
          'a "completed" session with questions left',
          (s: SubmitSessionRequest): SubmitSessionRequest => ({
            ...s,
            submissions: s.submissions.slice(0, 2),
            finishedAt: s.submissions[1]!.answeredAt,
          }),
          'inconsistent-ending',
        ],
        [
          'an end before the last answer',
          (s: SubmitSessionRequest): SubmitSessionRequest => ({
            ...s,
            finishedAt: s.finishedAt - 1,
          }),
          'inconsistent-ending',
        ],
        [
          'text answers in Easy mode',
          (s: SubmitSessionRequest): SubmitSessionRequest => ({
            ...s,
            submissions: [
              {
                answer: { kind: 'text', text: 'Paris' },
                answeredAt: s.startedAt + 1,
              },
            ],
            finishedAt: s.startedAt + 1,
            endReason: 'stopped',
          }),
          'invalid-submission',
        ],
        [
          'a finish in the future',
          (s: SubmitSessionRequest): SubmitSessionRequest => ({
            ...s,
            finishedAt: START + 60_000 + MAX_CLOCK_SKEW_MS + 1,
          }),
          'finished-in-the-future',
        ],
        [
          'a finish before the start',
          (s: SubmitSessionRequest): SubmitSessionRequest => ({
            ...s,
            submissions: [],
            finishedAt: s.startedAt - 1,
            endReason: 'stopped',
          }),
          'finished-before-start',
        ],
      ])('rejects %s with 422', async (_name, tamper, reason) => {
        const response = await post(tamper(playSession(engine, easyFixed)));

        expect(response.status).toBe(422);
        expect(response.headers['content-type']).toMatch(
          /^application\/problem\+json/,
        );
        expect(response.body.type).toBe(
          `urn:world-quiz:session-rejected:${reason}`,
        );
      });

      it('stores nothing for a rejected session', async () => {
        const session = playSession(engine, easyFixed);
        await post({ ...session, finishedAt: session.finishedAt - 1 });

        expect((await get(`/v1/sessions/${session.id}`)).status).toBe(404);
      });
    });

    it('answers 400 with the invalid fields for a body that breaks the contract', async () => {
      const session = playSession(engine, easyFixed);

      const response = await post({ ...session, score: 3, id: 'x' });

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('Invalid session');
      expect(response.body.errors.map((e: { path: string }) => e.path)).toEqual(
        expect.arrayContaining(['id', '']),
      );
    });

    it('answers 400 for malformed JSON', async () => {
      const response = await request(api.app)
        .post('/v1/sessions')
        .set('Authorization', player)
        .set('Content-Type', 'application/json')
        .send('{"id": ');

      expect(response.status).toBe(400);
      expect(response.body.title).toBe('Malformed JSON');
    });

    it('answers 413 for an oversized body', async () => {
      const response = await post({ padding: 'x'.repeat(300_000) });

      expect(response.status).toBe(413);
    });
  });

  describe('GET /:id', () => {
    it('returns the stored result', async () => {
      const session = playSession(engine, easyFixed);
      const created = await post(session);

      const response = await get(`/v1/sessions/${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(created.body);
    });

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      expect((await get(`/v1/sessions/${crypto.randomUUID()}`)).status).toBe(
        404,
      );
      expect((await get('/v1/sessions/42')).status).toBe(400);
    });
  });

  describe('GET / (history)', () => {
    const history = (query = '', authorization = player) =>
      get(`/v1/sessions${query}`, authorization);

    /** Lets recorded sessions out of the settle window. */
    const settle = () => api.clock.advance(HISTORY_SETTLE_MS);

    /** What the device that played a session derives from it. */
    const playedEvents = (session: SubmitSessionRequest): ProgressEvent[] => {
      const replayed = engine.replay(session);
      if (!replayed.ok) throw new Error('The test session must replay');
      return sessionProgressEvents(replayed.value, session.id);
    };

    /** What another device derives from the history. */
    const historyEvents = (entry: SessionHistoryEntry): ProgressEvent[] =>
      entry.answers.map((answer, sequence) => ({
        category: entry.config.category,
        difficulty: entry.config.difficulty,
        countryCode: answer.countryCode,
        correct: answer.correct,
        answeredAt: answer.answeredAt,
        sessionId: entry.id,
        sequence,
      }));

    it('requires a signed-in player', async () => {
      const response = await request(api.app).get('/v1/sessions');

      expect(response.status).toBe(401);
    });

    it("lists only the player's sessions, oldest first, graded by the server", async () => {
      const first = playSession(engine, easyFixed, { wrong: new Set([1]) });
      await post(first);
      api.clock.advance(1_000);
      const second = playSession(
        engine,
        { ...easyFixed, category: 'flags' },
        { seed: 'second' },
      );
      await post(second);
      const { authorization: other } = await api.signIn('player-2');
      await post(playSession(engine, easyFixed, { seed: 'theirs' }), other);
      settle();

      const response = await history();

      expect(response.status).toBe(200);
      expect(sessionHistoryPageSchema.safeParse(response.body).success).toBe(
        true,
      );
      const page = sessionHistoryPageSchema.parse(response.body);
      expect(page.sessions.map((entry) => entry.id)).toEqual([
        first.id,
        second.id,
      ]);
      expect(page.hasMore).toBe(false);
      const [entry] = page.sessions;
      expect(entry).toMatchObject({
        startedAt: first.startedAt,
        finishedAt: first.finishedAt,
        summary: { answered: 3, correct: 2 },
      });
      expect(entry?.answers.map((answer) => answer.correct)).toEqual([
        true,
        false,
        true,
      ]);
      expect(entry?.answers.map((answer) => answer.answeredAt)).toEqual(
        first.submissions.map((submission) => submission.answeredAt),
      );
    });

    it('rebuilds on another device exactly the progress of the device that played', async () => {
      const sessions = [
        playSession(engine, easyFixed, { wrong: new Set([0]) }),
        playSession(engine, easyFixed, {
          seed: 'later',
          startedAt: START + 10_000,
        }),
        playSession(
          engine,
          {
            category: 'flags',
            difficulty: 'easy',
            mode: 'endless',
            scope: 'europe',
          },
          { seed: 'endless', startedAt: START + 20_000, answers: 4 },
        ),
      ];
      for (const session of sessions) await post(session);
      settle();

      const page = sessionHistoryPageSchema.parse((await history()).body);

      expect(rebuildProgress(page.sessions.flatMap(historyEvents))).toEqual(
        rebuildProgress(sessions.flatMap(playedEvents)),
      );
    });

    it('pages with a cursor, never skipping or repeating sessions recorded in the same millisecond', async () => {
      const sessions = ['a', 'b', 'c'].map((seed) =>
        playSession(engine, easyFixed, { seed }),
      );
      for (const session of sessions) await post(session);
      settle();

      const first = sessionHistoryPageSchema.parse(
        (await history('?limit=2')).body,
      );
      const second = sessionHistoryPageSchema.parse(
        (await history(`?limit=2&after=${first.cursor}`)).body,
      );

      expect(first.sessions).toHaveLength(2);
      expect(first.hasMore).toBe(true);
      expect(second.sessions).toHaveLength(1);
      expect(second.hasMore).toBe(false);
      expect(
        [...first.sessions, ...second.sessions].map((entry) => entry.id).sort(),
      ).toEqual(sessions.map((session) => session.id).sort());
    });

    it('keeps a cursor for later: an empty page returns it, new sessions follow it', async () => {
      await post(playSession(engine, easyFixed));
      settle();
      const { cursor } = sessionHistoryPageSchema.parse((await history()).body);

      const empty = sessionHistoryPageSchema.parse(
        (await history(`?after=${cursor}`)).body,
      );
      const later = playSession(engine, easyFixed, { seed: 'later' });
      await post(later);
      settle();
      const next = sessionHistoryPageSchema.parse(
        (await history(`?after=${cursor}`)).body,
      );

      expect(empty).toEqual({ sessions: [], cursor, hasMore: false });
      expect(next.sessions.map((entry) => entry.id)).toEqual([later.id]);
    });

    it('answers a null cursor when there has never been a session', async () => {
      expect((await history()).body).toEqual({
        sessions: [],
        cursor: null,
        hasMore: false,
      });
    });

    it('lists a session only once the settle window has passed', async () => {
      const session = playSession(engine, easyFixed);
      await post(session);

      api.clock.advance(HISTORY_SETTLE_MS - 1);
      const early = sessionHistoryPageSchema.parse((await history()).body);
      api.clock.advance(1);
      const settled = sessionHistoryPageSchema.parse((await history()).body);

      expect(early.sessions).toEqual([]);
      expect(settled.sessions.map((entry) => entry.id)).toEqual([session.id]);
    });

    it.each([
      ['?limit=0'],
      ['?limit=101'],
      ['?after=bm90LWEtY3Vyc29y'],
      [`?after=${Buffer.from('1:not-a-uuid').toString('base64url')}`],
      ['?since=0'],
    ])('answers 400 for %s', async (query) => {
      const response = await history(query);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
    });
  });
});
