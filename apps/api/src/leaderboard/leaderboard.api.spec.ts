import {
  leaderboardSchema,
  myRecordsSchema,
  sessionResultSchema,
  type SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import {
  DEFAULT_FIXED_QUESTION_COUNT,
  type LeaderboardBoardId,
  type LeaderboardEntry,
  leaderboardMetricOf,
  rankingKey,
  rankLeaderboard,
  type QuizConfig,
  TIMED_MODE_DURATION_MS,
} from '@world-quiz/quiz/domain';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { defaultNickname } from '../auth/nickname';
import type { DatabaseHandle } from '../db/database';
import { leaderboardRuns, quizSessions } from '../db/schema';
import { playSession } from '../testing/play-session';
import { createTestApi, TEST_START, type TestApi } from '../testing/test-api';
import { createTestDatabase } from '../testing/test-database';
import { MIN_RANKED_ANSWER_MS } from './ranked-run-rules';

/** A quick round: ten questions, ranked by the time they took. */
const QUICK: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
};
const QUICK_BOARD: LeaderboardBoardId = 'capitals-easy-world-fixed';
/** A Time attack round: sixty seconds, ranked by the answers reached. */
const TIMED: QuizConfig = { ...QUICK, mode: 'timed' };
const TIMED_BOARD: LeaderboardBoardId = 'capitals-easy-world-timed';

describe('leaderboards', () => {
  let database: DatabaseHandle;
  let api: TestApi;
  let player: string;
  let playerId: string;

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

  interface PlayOptions {
    readonly authorization?: string;
    readonly wrong?: ReadonlySet<number>;
    readonly step?: number;
    /** Stop after this many answers (Endless and Time attack). */
    readonly answers?: number;
    readonly override?: Partial<SubmitSessionRequest>;
  }

  /** Plays an ordinary game and sends it, the way the app does. */
  const play = async (
    config: QuizConfig,
    {
      authorization = player,
      wrong = new Set<number>(),
      step = 1_000,
      answers,
      override = {},
    }: PlayOptions = {},
  ) => {
    const startedAt = api.clock.now();
    const played = playSession(api.engine, config, {
      startedAt,
      step,
      wrong,
      answers,
      seed: `seed-${crypto.randomUUID()}`,
    });
    // A timed round always ends with the clock, whatever the player reached.
    const session: SubmitSessionRequest =
      config.mode === 'timed'
        ? {
            ...played,
            finishedAt: startedAt + TIMED_MODE_DURATION_MS,
            endReason: 'time-up',
            ...override,
          }
        : { ...played, ...override };
    api.clock.set(session.finishedAt + 500);
    const response = await as(authorization).post('/v1/sessions', session);
    return { session, response, ranked: response.body.ranked };
  };

  const board = async (board: LeaderboardBoardId) =>
    leaderboardSchema.parse(
      (await request(api.app).get(`/v1/leaderboards/${board}`)).body,
    );

  beforeAll(async () => {
    database = await createTestDatabase();
    api = await createTestApi(database);
  });

  beforeEach(async () => {
    api.clock.set(TEST_START + 60_000);
    ({ authorization: player, userId: playerId } =
      await api.signIn('player-1'));
  });

  afterEach(async () => {
    await database.db.execute(sql`TRUNCATE users CASCADE`);
  });

  afterAll(async () => {
    await database.close();
  });

  describe('recording a ranked run', () => {
    it('puts a flawless quick round on the board of its own settings, ranked by time', async () => {
      const { session, response } = await play(QUICK, { step: 1_000 });

      expect(response.status).toBe(201);
      const runTime = DEFAULT_FIXED_QUESTION_COUNT * 1_000;
      expect(sessionResultSchema.parse(response.body).ranked).toEqual({
        board: QUICK_BOARD,
        score: runTime,
        timeMs: runTime,
        rank: 1,
        players: 1,
        personalRecord: true,
      });
      expect(session.finishedAt - session.startedAt).toBe(runTime);
      expect((await board(QUICK_BOARD)).entries).toEqual([
        {
          rank: 1,
          nickname: defaultNickname(playerId),
          score: runTime,
          timeMs: runTime,
          recordedAt: expect.any(String),
        },
      ]);
    });

    it('ranks a Time attack round by the answers it reached, timed to the last one', async () => {
      const { ranked } = await play(TIMED, { step: 2_000, answers: 7 });

      // What counts is the seven answers; the time is when the seventh
      // arrived, not the sixty seconds everyone spends.
      expect(ranked).toMatchObject({
        board: TIMED_BOARD,
        score: 7,
        timeMs: 7 * 2_000,
        rank: 1,
      });
    });

    it('records a run with a wrong answer, and leaves it off the board', async () => {
      const { response } = await play(QUICK, { wrong: new Set([4]) });

      expect(response.status).toBe(201);
      expect(response.body.ranked).toBeUndefined();
      expect((await board(QUICK_BOARD)).players).toBe(0);
    });

    it('never ranks a training mode: Endless, or a round over chosen countries', async () => {
      const endless = await play(
        { ...QUICK, mode: 'endless' },
        { answers: 5, override: { endReason: 'stopped' } },
      );
      const practice = await play({
        ...QUICK,
        countryCodes: ['fr', 'de', 'it'],
        questionCount: 3,
      });

      expect(endless.response.status).toBe(201);
      expect(endless.response.body.ranked).toBeUndefined();
      expect(practice.response.status).toBe(201);
      expect(practice.response.body.ranked).toBeUndefined();
    });

    it('refuses to rank a run nobody could have played that fast', async () => {
      const { response } = await play(QUICK, { step: 1 });

      expect(response.status).toBe(201);
      expect(response.body.ranked).toBeUndefined();
      // The floor is per answer, so a quick round has to take ten of them.
      expect(DEFAULT_FIXED_QUESTION_COUNT * MIN_RANKED_ANSWER_MS).toBe(2_500);
    });

    it('answers a retry with the same place, and records both runs of a player once on the board', async () => {
      const first = await play(QUICK, { step: 1_200 });
      const retry = await as(player).post('/v1/sessions', first.session);
      const faster = await play(QUICK, { step: 1_000 });
      const slower = await play(QUICK, { step: 3_000 });

      expect(retry.status).toBe(200);
      expect(retry.body.ranked).toEqual(first.ranked);
      expect(faster.ranked).toMatchObject({ rank: 1, personalRecord: true });
      // A slower run is still recorded and still ranked; it is simply not
      // the player's best, so the board keeps showing the faster one.
      expect(slower.ranked).toMatchObject({ rank: 1, personalRecord: false });
      const ranking = await board(QUICK_BOARD);
      expect(ranking.players).toBe(1);
      expect(ranking.entries).toHaveLength(1);
      expect(ranking.entries[0]?.score).toBe(
        DEFAULT_FIXED_QUESTION_COUNT * 1_000,
      );
    });
  });

  describe('rankings', () => {
    it('keeps each player once, with their best run, the best first', async () => {
      const { authorization: bob } = await api.signIn('player-2');
      await as(bob).patch('/v1/me', { nickname: 'Bob the Quick' });

      await play(QUICK, { step: 1_500 });
      await play(QUICK, { authorization: bob, step: 1_200 });

      const ranking = await board(QUICK_BOARD);
      expect(ranking.players).toBe(2);
      expect(ranking.entries.map((entry) => entry.nickname)).toEqual([
        'Bob the Quick',
        defaultNickname(playerId),
      ]);
    });

    it('ranks a Time attack board by the most answers, a tie by who got there first', async () => {
      const { authorization: bob } = await api.signIn('player-2');
      await as(bob).patch('/v1/me', { nickname: 'Bob' });

      // Bob answers as many as the player, but faster.
      await play(TIMED, { step: 3_000, answers: 6 });
      await play(TIMED, { authorization: bob, step: 2_000, answers: 6 });

      const ranking = await board(TIMED_BOARD);
      expect(
        ranking.entries.map((entry) => [entry.nickname, entry.score]),
      ).toEqual([
        ['Bob', 6],
        [defaultNickname(playerId), 6],
      ]);
    });

    it('orders exactly as the domain ranks, on a board where more is better', async () => {
      // Runs written straight to the tables: many players, equal scores.
      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < 12; i++) {
        const { userId } = await api.signIn(`ranked-${i}`);
        for (let run = 0; run < 2; run++) {
          const entry: LeaderboardEntry = {
            entryId: crypto.randomUUID(),
            userId,
            boardId: TIMED_BOARD,
            score: 10 + ((i * 7 + run * 3) % 5),
            timeMs: 40_000 + ((i * 3 + run) % 3) * 1_000,
            recordedAt: TEST_START + ((i * 5 + run) % 4) * 1_000,
          };
          entries.push(entry);
          await insertRankedRun(database, entry);
        }
      }

      const ranking = await board(TIMED_BOARD);
      const expected = rankLeaderboard(entries, TIMED_BOARD);

      expect(ranking.players).toBe(12);
      expect(
        ranking.entries.map((entry) => [entry.rank, entry.score, entry.timeMs]),
      ).toEqual(
        expected.map((entry) => [entry.rank, entry.score, entry.timeMs]),
      );
    });

    it('is public, always revalidated, and limited on request', async () => {
      const { authorization: bob } = await api.signIn('player-2');
      await play(QUICK);
      await play(QUICK, { authorization: bob });

      const response = await request(api.app).get(
        `/v1/leaderboards/${QUICK_BOARD}?limit=1`,
      );

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe(
        'public, max-age=0, must-revalidate',
      );
      expect(response.headers['etag']).toBeDefined();
      expect(response.body.players).toBe(2);
      expect(response.body.entries).toHaveLength(1);
      expect(JSON.stringify(response.body)).not.toContain(playerId);
      expect(
        (await request(api.app).get('/v1/leaderboards/capitals-easy')).status,
      ).toBe(404);
      expect(
        (await request(api.app).get(`/v1/leaderboards/${QUICK_BOARD}?limit=0`))
          .status,
      ).toBe(400);
    });
  });

  describe('/v1/me', () => {
    it("lists the player's records per board with the rank and the field size", async () => {
      expect((await as(player).get('/v1/me/records')).body).toEqual({
        records: [],
      });
      const { authorization: bob } = await api.signIn('player-2');
      await play(QUICK, { authorization: bob, step: 900 });
      const run = await play(QUICK, { step: 1_000 });
      await play(TIMED, { step: 2_000, answers: 4 });

      const { records } = myRecordsSchema.parse(
        (await as(player).get('/v1/me/records')).body,
      );

      expect(records).toEqual([
        {
          board: QUICK_BOARD,
          nickname: defaultNickname(playerId),
          rank: 2,
          players: 2,
          score: run.session.finishedAt - run.session.startedAt,
          timeMs: run.session.finishedAt - run.session.startedAt,
          recordedAt: expect.any(String),
        },
        {
          board: TIMED_BOARD,
          nickname: defaultNickname(playerId),
          rank: 1,
          players: 1,
          score: 4,
          timeMs: 4 * 2_000,
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

/** A ranked run written directly: a session row and its verdict. */
async function insertRankedRun(
  database: DatabaseHandle,
  entry: LeaderboardEntry,
) {
  const recordedAt = new Date(entry.recordedAt);
  const config: QuizConfig = {
    category: 'capitals',
    difficulty: 'easy',
    mode: 'timed',
    scope: 'world',
  };
  await database.db.insert(quizSessions).values({
    id: entry.entryId,
    userId: entry.userId,
    ...config,
    config,
    seed: 'seed',
    startedAt: recordedAt,
    finishedAt: recordedAt,
    endReason: 'time-up',
    answered: entry.score,
    correct: entry.score,
    durationMs: entry.timeMs,
    completed: true,
    perfect: true,
    requestHash: `hash-${entry.entryId}`,
    recordedAt,
  });
  await database.db.insert(leaderboardRuns).values({
    sessionId: entry.entryId,
    userId: entry.userId,
    board: entry.boardId,
    score: entry.score,
    timeMs: entry.timeMs,
    rankKey: rankingKey(entry.score, leaderboardMetricOf(entry.boardId)),
    recordedAt,
    personalRecord: false,
  });
}
