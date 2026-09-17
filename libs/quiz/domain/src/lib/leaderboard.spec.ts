import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import type { LeaderboardEntry } from './leaderboard';
import {
  compareLeaderboardEntries,
  evaluateChallengeRun,
  isNewPersonalRecord,
  personalBests,
  rankLeaderboard,
} from './leaderboard';
import type { QuizConfig, QuizSession } from './session';
import { createQuizEngine } from './session';

const engine = createQuizEngine(FIXTURE_DATASET);
const T0 = 50_000;

function run(
  config: QuizConfig,
  options: { wrongAt?: number; stopAfter?: number } = {},
): QuizSession {
  const started = engine.start(config, { seed: 'challenge', startedAt: T0 });
  if (!started.ok) throw new Error(started.error);
  let session = started.value;
  let index = 0;
  while (session.status === 'active') {
    if (options.stopAfter === index) {
      return engine.stop(session, T0 + index * 1_000 + 1);
    }
    const question = engine.currentQuestion(session)!;
    const wrong = question.choices!.find(
      (code) => code !== question.countryCode,
    )!;
    const choice = options.wrongAt === index ? wrong : question.countryCode;
    const result = engine.submitAnswer(
      session,
      { kind: 'choice', countryCode: choice },
      T0 + (index + 1) * 1_000,
    );
    if (!result.ok) throw new Error(result.error);
    session = result.session;
    index++;
  }
  return session;
}

const challenge: QuizConfig = {
  category: 'flags',
  difficulty: 'easy',
  mode: 'challenge',
  scope: 'world',
};
const evaluate = (session: QuizSession, dataset = FIXTURE_DATASET) =>
  evaluateChallengeRun(session, engine.summarize(session), dataset);

describe('evaluateChallengeRun', () => {
  it('ranks a complete, perfect World run by completion time on the matching board', () => {
    const result = evaluate(run(challenge));

    expect(result).toEqual({
      eligible: true,
      board: {
        id: 'flags-easy',
        category: 'flags',
        difficulty: 'easy',
        scope: 'world',
      },
      completionTimeMs: FIXTURE_DATASET.length * 1_000,
    });
  });

  it('rejects a run with any incorrect answer', () => {
    expect(evaluate(run(challenge, { wrongAt: 7 }))).toEqual({
      eligible: false,
      reason: 'has-incorrect-answers',
    });
  });

  it('rejects abandoned runs', () => {
    expect(evaluate(run(challenge, { stopAfter: 5 }))).toEqual({
      eligible: false,
      reason: 'incomplete',
    });
  });

  it('rejects runs that are still in progress', () => {
    const started = engine.start(challenge, { seed: 'x', startedAt: T0 });
    if (!started.ok) throw new Error(started.error);
    expect(evaluate(started.value)).toEqual({
      eligible: false,
      reason: 'not-finished',
    });
  });

  it.each<QuizConfig>([
    { ...challenge, mode: 'fixed', questionCount: FIXTURE_DATASET.length },
    { ...challenge, mode: 'timed' },
    { ...challenge, mode: 'endless' },
  ])('never ranks training mode $mode, even when perfect', (config) => {
    expect(
      evaluate(
        run({ ...config }, config.mode === 'fixed' ? {} : { stopAfter: 3 }),
      ),
    ).toEqual({
      eligible: false,
      reason: 'not-a-challenge',
    });
  });

  it('rejects a run that does not cover the full dataset the server knows', () => {
    const session = run(challenge);
    const biggerDataset = [
      ...FIXTURE_DATASET,
      { ...FIXTURE_DATASET[0]!, code: 'zz' },
    ];
    expect(evaluate(session, biggerDataset)).toEqual({
      eligible: false,
      reason: 'invalid-question-set',
    });
  });
});

const entry = (overrides: Partial<LeaderboardEntry>): LeaderboardEntry => ({
  entryId: 'e',
  userId: 'u',
  boardId: 'capitals-easy',
  completionTimeMs: 100_000,
  recordedAt: 1,
  ...overrides,
});

describe('ranking', () => {
  it('orders by completion time, then server-recorded time, then entry id', () => {
    const fast = entry({
      entryId: 'c',
      completionTimeMs: 90_000,
      recordedAt: 9,
    });
    const tieEarlier = entry({ entryId: 'b', recordedAt: 1 });
    const tieLaterA = entry({ entryId: 'a', recordedAt: 2 });
    const tieLaterB = entry({ entryId: 'd', recordedAt: 2 });

    expect(
      [tieLaterB, tieLaterA, tieEarlier, fast].sort(compareLeaderboardEntries),
    ).toEqual([fast, tieEarlier, tieLaterA, tieLaterB]);
  });

  it('keeps each user’s best run per board', () => {
    const bests = personalBests([
      entry({ entryId: '1', userId: 'ann', completionTimeMs: 120_000 }),
      entry({ entryId: '2', userId: 'ann', completionTimeMs: 95_000 }),
      entry({
        entryId: '3',
        userId: 'ann',
        boardId: 'flags-hard',
        completionTimeMs: 300_000,
      }),
      entry({ entryId: '4', userId: 'bob', completionTimeMs: 99_000 }),
    ]);
    expect(bests.map((e) => e.entryId).sort()).toEqual(['2', '3', '4']);
  });

  it('never merges different users or boards, whatever characters ids contain', () => {
    const bests = personalBests([
      entry({ entryId: '1', userId: 'ann' }),
      entry({ entryId: '2', userId: 'ann ' }),
      entry({ entryId: '3', userId: '["capitals-easy","ann"]' }),
      entry({ entryId: '4', userId: 'ann', boardId: 'capitals-hard' }),
    ]);
    expect(bests.map((e) => e.entryId).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('ranks one board with unique ranks starting at 1', () => {
    const ranked = rankLeaderboard(
      [
        entry({ entryId: '1', userId: 'ann', completionTimeMs: 120_000 }),
        entry({ entryId: '2', userId: 'ann', completionTimeMs: 95_000 }),
        entry({
          entryId: '3',
          userId: 'bob',
          completionTimeMs: 95_000,
          recordedAt: 0,
        }),
        entry({ entryId: '4', userId: 'cat', completionTimeMs: 80_000 }),
        entry({
          entryId: '5',
          userId: 'dan',
          boardId: 'flags-easy',
          completionTimeMs: 1,
        }),
      ],
      'capitals-easy',
    );

    expect(ranked.map(({ userId, rank }) => ({ userId, rank }))).toEqual([
      { userId: 'cat', rank: 1 },
      { userId: 'bob', rank: 2 },
      { userId: 'ann', rank: 3 },
    ]);
  });

  it('returns an empty ranking for a board without entries', () => {
    expect(rankLeaderboard([], 'flags-hard')).toEqual([]);
  });
});

describe('isNewPersonalRecord', () => {
  it.each([
    [null, 100_000, true],
    [100_000, 99_999, true],
    [100_000, 100_000, false],
    [100_000, 100_001, false],
  ])('previous %s, new %s → %s', (previous, candidate, expected) => {
    expect(isNewPersonalRecord(previous, candidate)).toBe(expected);
  });
});
