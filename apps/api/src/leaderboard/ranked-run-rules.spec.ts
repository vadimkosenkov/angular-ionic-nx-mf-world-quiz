import {
  createQuizEngine,
  type QuizConfig,
  type QuizSession,
  TIMED_MODE_DURATION_MS,
} from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import {
  MIN_RANKED_ANSWER_MS,
  rankedRunOf,
  verdictOf,
} from './ranked-run-rules';

const engine = createQuizEngine(FIXTURE_DATASET);
const T0 = Date.UTC(2026, 10, 1);
const QUICK: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
};

/** Plays a flawless round, one answer every `step` milliseconds. */
function flawless(config: QuizConfig, step: number, answers = Infinity) {
  const started = engine.start(config, { seed: 'rules', startedAt: T0 });
  if (!started.ok) throw new Error(started.error);
  let session: QuizSession = started.value;
  let given = 0;
  while (session.status === 'active' && given < answers) {
    const question = engine.currentQuestion(session);
    if (!question) break;
    const result = engine.submitAnswer(
      session,
      { kind: 'choice', countryCode: question.countryCode },
      T0 + ++given * step,
    );
    if (!result.ok) throw new Error(result.error);
    session = result.session;
  }
  if (session.status === 'active') {
    session = engine.expire(session, T0 + TIMED_MODE_DURATION_MS);
  }
  return { session, summary: engine.summarize(session) };
}

describe('rankedRunOf', () => {
  it('accepts a flawless round the player had time to play', () => {
    const { session, summary } = flawless(QUICK, 1_000);

    expect(rankedRunOf(session, summary)).toEqual({
      board: expect.objectContaining({ id: 'capitals-easy-world-fixed' }),
      score: { value: 10_000, timeMs: 10_000 },
    });
  });

  it('refuses a time nobody could have played', () => {
    const fast = flawless(QUICK, MIN_RANKED_ANSWER_MS - 1);
    const justEnough = flawless(QUICK, MIN_RANKED_ANSWER_MS);

    expect(rankedRunOf(fast.session, fast.summary)).toBeNull();
    expect(rankedRunOf(justEnough.session, justEnough.summary)).not.toBeNull();
  });
});

describe('verdictOf', () => {
  it('stores a time board run by its milliseconds, and the first run is a record', () => {
    const { session, summary } = flawless(QUICK, 1_000);
    const run = rankedRunOf(session, summary);
    if (!run) throw new Error('expected a ranked run');

    expect(verdictOf(run, null)).toEqual({
      board: 'capitals-easy-world-fixed',
      score: 10_000,
      timeMs: 10_000,
      rankKey: 10_000,
      personalRecord: true,
    });
    expect(verdictOf(run, { value: 9_000, timeMs: 9_000 }).personalRecord).toBe(
      false,
    );
  });

  it('negates the key of a board where more answers is better', () => {
    const { session, summary } = flawless(
      { ...QUICK, mode: 'timed' },
      3_000,
      5,
    );
    const run = rankedRunOf(session, summary);
    if (!run) throw new Error('expected a ranked run');

    expect(verdictOf(run, { value: 5, timeMs: 20_000 })).toEqual({
      board: 'capitals-easy-world-timed',
      score: 5,
      timeMs: 15_000,
      rankKey: -5,
      // The same five answers, reached sooner.
      personalRecord: true,
    });
  });
});
