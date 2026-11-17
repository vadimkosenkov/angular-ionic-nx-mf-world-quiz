import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import type { LeaderboardEntry, RankedScore } from './leaderboard';
import {
  compareLeaderboardEntries,
  evaluateRankedRun,
  formatRunTime,
  isNewPersonalRecord,
  leaderboardMetricOf,
  personalBests,
  rankingKey,
  rankLeaderboard,
} from './leaderboard';
import type { QuizConfig, QuizSession } from './session';
import { createQuizEngine } from './session';
import { TIMED_MODE_DURATION_MS } from './vocabulary';

const engine = createQuizEngine(FIXTURE_DATASET);
const T0 = 50_000;

/** A second per answer, so a run's time is readable in the expectations. */
const ANSWER_MS = 1_000;

interface Played {
  /** Answer this many questions before the run ends. */
  readonly answers?: number;
  /** Answer this one wrongly. */
  readonly wrongAt?: number;
  /** Abandon the run after this many answers. */
  readonly stopAfter?: number;
  /** Leave the run running. */
  readonly unfinished?: boolean;
}

function run(config: QuizConfig, options: Played = {}): QuizSession {
  const started = engine.start(config, { seed: 'ranked', startedAt: T0 });
  if (!started.ok) throw new Error(started.error);
  let session = started.value;
  if (options.unfinished) return session;

  let index = 0;
  while (session.status === 'active') {
    const at = T0 + (index + 1) * ANSWER_MS;
    if (options.stopAfter === index) return engine.stop(session, at);
    if (options.answers === index) {
      return engine.expire(session, T0 + TIMED_MODE_DURATION_MS);
    }
    const question = engine.currentQuestion(session);
    if (!question) break;
    const wrong = question.choices?.find(
      (code) => code !== question.countryCode,
    );
    const choice =
      options.wrongAt === index && wrong ? wrong : question.countryCode;
    const result = engine.submitAnswer(
      session,
      { kind: 'choice', countryCode: choice },
      at,
    );
    if (!result.ok) throw new Error(result.error);
    session = result.session;
    index++;
  }
  return session;
}

const quick: QuizConfig = {
  category: 'flags',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
};
const timed: QuizConfig = { ...quick, mode: 'timed', scope: 'europe' };

const evaluate = (session: QuizSession) =>
  evaluateRankedRun(session, engine.summarize(session));

describe('evaluateRankedRun', () => {
  it('ranks a flawless quick round by its time, on the board of its four choices', () => {
    expect(evaluate(run(quick))).toEqual({
      eligible: true,
      board: {
        id: 'flags-easy-world-fixed',
        category: 'flags',
        difficulty: 'easy',
        scope: 'world',
        mode: 'fixed',
        metric: 'time',
      },
      // Ten questions, a second each.
      score: { value: 10 * ANSWER_MS, timeMs: 10 * ANSWER_MS },
    });
  });

  it('ranks a flawless timed round by how many answers it reached', () => {
    // Six answers, then the clock runs out. What ranks is the six; the time
    // is when the sixth arrived, not the sixty seconds everyone spends.
    expect(evaluate(run(timed, { answers: 6 }))).toEqual({
      eligible: true,
      board: {
        id: 'flags-easy-europe-timed',
        category: 'flags',
        difficulty: 'easy',
        scope: 'europe',
        mode: 'timed',
        metric: 'correct',
      },
      score: { value: 6, timeMs: 6 * ANSWER_MS },
    });
  });

  it('keeps a run with a single wrong answer off every board', () => {
    expect(evaluate(run(quick, { wrongAt: 7 }))).toEqual({
      eligible: false,
      reason: 'has-incorrect-answers',
    });
    expect(evaluate(run(timed, { wrongAt: 2, answers: 6 }))).toEqual({
      eligible: false,
      reason: 'has-incorrect-answers',
    });
  });

  it('rejects an abandoned quick round', () => {
    expect(evaluate(run(quick, { stopAfter: 5 }))).toEqual({
      eligible: false,
      reason: 'incomplete',
    });
  });

  it('rejects a run that is still being played', () => {
    expect(evaluate(run(quick, { unfinished: true }))).toEqual({
      eligible: false,
      reason: 'not-finished',
    });
  });

  it('rejects a timed round nobody answered anything in', () => {
    expect(evaluate(run(timed, { answers: 0 }))).toEqual({
      eligible: false,
      reason: 'no-answers',
    });
  });

  it('never ranks Endless, which has no end to compare', () => {
    expect(
      evaluate(run({ ...quick, mode: 'endless' }, { stopAfter: 4 })),
    ).toEqual({ eligible: false, reason: 'not-a-ranked-mode' });
  });

  it('rejects a quick round of another length, which is another game', () => {
    expect(evaluate(run({ ...quick, questionCount: 3 }))).toEqual({
      eligible: false,
      reason: 'non-standard-length',
    });
  });

  it('never ranks a round over countries the player chose', () => {
    // Practice Mistakes: a set nobody else is asked, and an easier one each
    // time it is played.
    const codes = FIXTURE_DATASET.slice(0, 10).map((country) => country.code);
    expect(
      evaluate(run({ ...quick, countryCodes: codes, questionCount: 10 })),
    ).toEqual({ eligible: false, reason: 'chosen-countries' });
  });
});

const entry = (overrides: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  entryId: 'e',
  userId: 'u',
  boardId: 'capitals-easy-world-fixed',
  score: 100_000,
  timeMs: 100_000,
  recordedAt: 1,
  ...overrides,
});

/** An entry on a board that ranks by answers rather than by time. */
const counted = (overrides: Partial<LeaderboardEntry>): LeaderboardEntry =>
  entry({
    boardId: 'capitals-easy-world-timed',
    score: 20,
    timeMs: 40_000,
    ...overrides,
  });

describe('ranking', () => {
  it('knows what each board ranks by', () => {
    expect(leaderboardMetricOf('capitals-easy-world-fixed')).toBe('time');
    expect(leaderboardMetricOf('flags-hard-oceania-timed')).toBe('correct');
  });

  it('orders a time board by the time, then the earlier run, then the id', () => {
    const fast = entry({ entryId: 'c', score: 90_000, recordedAt: 9 });
    const tieEarlier = entry({ entryId: 'b', recordedAt: 1 });
    const tieLaterA = entry({ entryId: 'a', recordedAt: 2 });
    const tieLaterB = entry({ entryId: 'd', recordedAt: 2 });

    expect(
      [tieLaterB, tieLaterA, tieEarlier, fast].sort(compareLeaderboardEntries),
    ).toEqual([fast, tieEarlier, tieLaterA, tieLaterB]);
  });

  it('orders an answers board by the count, and a tie by who got there first', () => {
    const most = counted({ entryId: 'c', score: 24 });
    const sameCountQuicker = counted({ entryId: 'a', timeMs: 30_000 });
    const sameCountSlower = counted({ entryId: 'b', timeMs: 55_000 });

    expect(
      [sameCountSlower, sameCountQuicker, most].sort(compareLeaderboardEntries),
    ).toEqual([most, sameCountQuicker, sameCountSlower]);
  });

  it('keeps each user’s best run per board', () => {
    const bests = personalBests([
      entry({ entryId: '1', userId: 'ann', score: 120_000 }),
      entry({ entryId: '2', userId: 'ann', score: 95_000 }),
      entry({
        entryId: '3',
        userId: 'ann',
        boardId: 'flags-hard-asia-fixed',
        score: 300_000,
      }),
      entry({ entryId: '4', userId: 'bob', score: 99_000 }),
    ]);
    expect(bests.map((e) => e.entryId).sort()).toEqual(['2', '3', '4']);
  });

  it('never merges different users or boards, whatever characters ids contain', () => {
    const bests = personalBests([
      entry({ entryId: '1', userId: 'ann' }),
      entry({ entryId: '2', userId: 'ann ' }),
      entry({ entryId: '3', userId: '["capitals-easy-world-fixed","ann"]' }),
      entry({
        entryId: '4',
        userId: 'ann',
        boardId: 'capitals-hard-world-fixed',
      }),
    ]);
    expect(bests.map((e) => e.entryId).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('ranks one board with unique ranks starting at 1', () => {
    const ranked = rankLeaderboard(
      [
        entry({ entryId: '1', userId: 'ann', score: 120_000 }),
        entry({ entryId: '2', userId: 'ann', score: 95_000 }),
        entry({ entryId: '3', userId: 'bob', score: 95_000, recordedAt: 0 }),
        entry({ entryId: '4', userId: 'cat', score: 80_000 }),
        entry({
          entryId: '5',
          userId: 'dan',
          boardId: 'flags-easy-world-fixed',
          score: 1,
        }),
      ],
      'capitals-easy-world-fixed',
    );

    expect(ranked.map(({ userId, rank }) => ({ userId, rank }))).toEqual([
      { userId: 'cat', rank: 1 },
      { userId: 'bob', rank: 2 },
      { userId: 'ann', rank: 3 },
    ]);
  });

  it('returns an empty ranking for a board without entries', () => {
    expect(rankLeaderboard([], 'flags-hard-africa-timed')).toEqual([]);
  });
});

describe('isNewPersonalRecord', () => {
  const score = (value: number, timeMs = value): RankedScore => ({
    value,
    timeMs,
  });

  it('is any first run', () => {
    expect(isNewPersonalRecord(null, score(100_000), 'time')).toBe(true);
    expect(isNewPersonalRecord(null, score(3, 9_000), 'correct')).toBe(true);
  });

  it('on a time board, is a strictly faster run', () => {
    const best = score(100_000);
    expect(isNewPersonalRecord(best, score(99_999), 'time')).toBe(true);
    expect(isNewPersonalRecord(best, score(100_000), 'time')).toBe(false);
    expect(isNewPersonalRecord(best, score(100_001), 'time')).toBe(false);
  });

  it('on an answers board, is more answers — or the same, reached faster', () => {
    const best = score(20, 50_000);
    expect(isNewPersonalRecord(best, score(21, 59_000), 'correct')).toBe(true);
    expect(isNewPersonalRecord(best, score(20, 49_999), 'correct')).toBe(true);
    expect(isNewPersonalRecord(best, score(20, 50_000), 'correct')).toBe(false);
    expect(isNewPersonalRecord(best, score(19, 10_000), 'correct')).toBe(false);
  });
});

describe('formatRunTime', () => {
  it.each([
    [0, '0:00.0'],
    [9_999, '0:09.9'],
    [60_000, '1:00.0'],
    [247_349, '4:07.3'],
    [3_600_000, '60:00.0'],
  ])('shows %i ms as %s, rounded down like a stopwatch', (ms, text) => {
    expect(formatRunTime(ms)).toBe(text);
  });
});

describe('rankingKey', () => {
  it('is the time itself where the fastest wins', () => {
    expect(rankingKey(90_000, 'time')).toBeLessThan(rankingKey(95_000, 'time'));
  });

  it('is the count negated where the most answers wins', () => {
    // One ascending order serves both kinds of board (backend.md).
    expect(rankingKey(24, 'correct')).toBeLessThan(rankingKey(20, 'correct'));
  });
});
