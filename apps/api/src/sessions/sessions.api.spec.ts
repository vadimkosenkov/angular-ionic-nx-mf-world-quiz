import type { SubmitSessionRequest } from '@world-quiz/shared/contracts';
import { createQuizEngine, type QuizConfig } from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { createManualClock } from '@world-quiz/shared/util';
import { count, sql } from 'drizzle-orm';
import request from 'supertest';
import { createApp } from '../app';
import type { DatabaseHandle } from '../db/database';
import { quizSessions } from '../db/schema';
import { readAnswers } from '../testing/read-answers';
import { createTestDatabase } from '../testing/test-database';
import { playSession } from '../testing/play-session';
import { createSessionRepository } from './session-repository';
import { createSessionService, MAX_CLOCK_SKEW_MS } from './session-service';

const engine = createQuizEngine(FIXTURE_DATASET);
const START = 1_700_000_000_000;

const easyFixed: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'europe',
  questionCount: 3,
};

describe('/v1/sessions', () => {
  let database: DatabaseHandle;
  const clock = createManualClock(START + 60_000);

  const app = () =>
    createApp({
      clock,
      sessions: createSessionService({
        repository: createSessionRepository(database.db),
        engine,
        clock,
      }),
    });

  const post = (body: unknown) =>
    request(app())
      .post('/v1/sessions')
      .send(body as object);

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  beforeEach(() => {
    clock.set(START + 60_000);
  });

  afterEach(async () => {
    await database.db.execute(sql`TRUNCATE quiz_sessions CASCADE`);
  });

  afterAll(async () => {
    await database.close();
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
      clock.advance(5_000);
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
        (await request(app()).get(`/v1/sessions/${session.id.toUpperCase()}`))
          .body,
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

        expect(
          (await request(app()).get(`/v1/sessions/${session.id}`)).status,
        ).toBe(404);
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
      const response = await request(app())
        .post('/v1/sessions')
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

      const response = await request(app()).get(`/v1/sessions/${session.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(created.body);
    });

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      expect(
        (await request(app()).get(`/v1/sessions/${crypto.randomUUID()}`))
          .status,
      ).toBe(404);
      expect((await request(app()).get('/v1/sessions/42')).status).toBe(400);
    });
  });
});
