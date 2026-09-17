import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import { indexCountriesByCode } from './country';
import type {
  QuizConfig,
  QuizSession,
  SessionRecord,
  SubmittedAnswer,
} from './session';
import { createQuizEngine } from './session';
import { TIMED_MODE_DURATION_MS } from './vocabulary';

const engine = createQuizEngine(FIXTURE_DATASET);
const countries = indexCountriesByCode(FIXTURE_DATASET);
const T0 = 1_000_000;

function start(config: QuizConfig, seed = 'seed'): QuizSession {
  const result = engine.start(config, { seed, startedAt: T0 });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

/** The answer a perfect player would give to the current question. */
function correctAnswer(session: QuizSession): SubmittedAnswer {
  const question = engine.currentQuestion(session);
  if (!question) throw new Error('No current question');
  if (session.config.difficulty === 'easy') {
    return { kind: 'choice', countryCode: question.countryCode };
  }
  const country = countries.get(question.countryCode);
  const text =
    session.config.category === 'capitals'
      ? country?.capital.en
      : country?.name.en;
  return { kind: 'text', text: text as string };
}

/** A wrong answer for the current question. */
function wrongAnswer(session: QuizSession): SubmittedAnswer {
  const question = engine.currentQuestion(session);
  if (!question) throw new Error('No current question');
  if (session.config.difficulty === 'easy') {
    const wrong = question.choices?.find(
      (code) => code !== question.countryCode,
    );
    return { kind: 'choice', countryCode: wrong as string };
  }
  return { kind: 'text', text: 'Atlantis' };
}

function answer(
  session: QuizSession,
  submitted: SubmittedAnswer,
  at: number,
): QuizSession {
  const result = engine.submitAnswer(session, submitted, at);
  if (!result.ok) throw new Error(result.error);
  return result.session;
}

const fixedEasy: QuizConfig = {
  category: 'capitals',
  difficulty: 'easy',
  mode: 'fixed',
  scope: 'world',
};

describe('QuizEngine.start', () => {
  it('creates an active session without answers', () => {
    const session = start(fixedEasy);

    expect(session).toEqual({
      config: fixedEasy,
      seed: 'seed',
      startedAt: T0,
      answers: [],
      status: 'active',
      finishedAt: null,
      endReason: null,
    });
    expect(engine.questions(session).length).toBe(10);
  });

  it.each<[string, QuizConfig, string]>([
    [
      'zero questions',
      { ...fixedEasy, questionCount: 0 },
      'invalid-question-count',
    ],
    [
      'fractional count',
      { ...fixedEasy, questionCount: 2.5 },
      'invalid-question-count',
    ],
    [
      'count outside Fixed',
      { ...fixedEasy, mode: 'endless', questionCount: 5 },
      'question-count-requires-fixed-mode',
    ],
    [
      'unknown country',
      { ...fixedEasy, countryCodes: ['fr', 'zz'] },
      'unknown-country',
    ],
    ['empty restriction', { ...fixedEasy, countryCodes: [] }, 'empty-pool'],
    [
      'restriction outside scope',
      { ...fixedEasy, scope: 'asia', countryCodes: ['fr'] },
      'empty-pool',
    ],
    [
      'regional challenge',
      { ...fixedEasy, mode: 'challenge', scope: 'europe' },
      'challenge-requires-world-scope',
    ],
    [
      'restricted challenge',
      { ...fixedEasy, mode: 'challenge', countryCodes: ['fr'] },
      'challenge-cannot-be-restricted',
    ],
  ])('rejects %s', (_, config, error) => {
    expect(engine.start(config, { seed: 's', startedAt: T0 })).toEqual({
      ok: false,
      error,
    });
  });

  it('caps Fixed length at the pool size', () => {
    const session = start({
      ...fixedEasy,
      scope: 'south-america',
      questionCount: 10,
    });
    expect(engine.questions(session).length).toBe(2);
  });

  it('restricts the pool for Practice Mistakes', () => {
    const session = start({
      ...fixedEasy,
      countryCodes: ['fr', 'jp'],
      questionCount: 2,
    });
    const asked = [0, 1].map(
      (i) => engine.questions(session).questionAt(i).countryCode,
    );
    expect(asked.sort()).toEqual(['fr', 'jp']);
  });
});

describe('Fixed mode', () => {
  it('finishes as completed after the configured number of questions', () => {
    let session = start({ ...fixedEasy, questionCount: 3 });
    session = answer(session, correctAnswer(session), T0 + 1_000);
    session = answer(session, wrongAnswer(session), T0 + 2_000);
    expect(session.status).toBe('active');
    session = answer(session, correctAnswer(session), T0 + 3_000);

    expect(session).toMatchObject({
      status: 'finished',
      endReason: 'completed',
      finishedAt: T0 + 3_000,
    });
    expect(engine.currentQuestion(session)).toBeNull();
    expect(engine.summarize(session)).toMatchObject({
      totalQuestions: 3,
      answered: 3,
      correct: 2,
      incorrect: 1,
      durationMs: 3_000,
      completed: true,
      perfect: false,
    });
  });

  it('records what was asked, answered and how it was judged', () => {
    const session = start(fixedEasy);
    const question = engine.currentQuestion(session);
    const result = engine.submitAnswer(
      session,
      correctAnswer(session),
      T0 + 500,
    );

    expect(result.ok && result.record).toEqual({
      questionIndex: 0,
      countryCode: question?.countryCode,
      answer: { kind: 'choice', countryCode: question?.countryCode },
      correct: true,
      judgement: 'choice',
      answeredAt: T0 + 500,
    });
  });

  it('can be stopped early and is then incomplete', () => {
    let session = start(fixedEasy);
    session = answer(session, correctAnswer(session), T0 + 1_000);
    session = engine.stop(session, T0 + 5_000);

    expect(session).toMatchObject({
      status: 'finished',
      endReason: 'stopped',
      finishedAt: T0 + 5_000,
    });
    expect(engine.summarize(session)).toMatchObject({
      completed: false,
      perfect: false,
      answered: 1,
    });
  });

  it('does not change the original session (immutability)', () => {
    const session = start(fixedEasy);
    engine.submitAnswer(session, correctAnswer(session), T0 + 1);
    expect(session.answers).toEqual([]);
  });
});

describe('Hard mode', () => {
  const hard: QuizConfig = {
    ...fixedEasy,
    difficulty: 'hard',
    questionCount: 3,
  };

  it('grades typed text, including typos, with the matched answer', () => {
    let session = start(hard);
    const question = engine.currentQuestion(session);
    const capital = countries.get(question?.countryCode as string)?.capital
      .en as string;
    const result = engine.submitAnswer(
      session,
      { kind: 'text', text: `  ${capital.toUpperCase()} ` },
      T0 + 1,
    );

    expect(result.ok && result.record).toMatchObject({
      correct: true,
      judgement: 'exact',
      matchedText: capital,
    });
    session = result.ok ? result.session : session;
    const next = engine.submitAnswer(
      session,
      { kind: 'text', text: 'Atlantis' },
      T0 + 2,
    );
    expect(next.ok && next.record).toMatchObject({
      correct: false,
      judgement: 'incorrect',
    });
  });

  it('grades Flags questions against country names', () => {
    const session = start({ ...hard, category: 'flags' });
    const question = engine.currentQuestion(session);
    const nameRu = countries.get(question?.countryCode as string)?.name
      .ru as string;
    const result = engine.submitAnswer(
      session,
      { kind: 'text', text: nameRu },
      T0 + 1,
    );
    expect(result.ok && result.record.correct).toBe(true);
  });
});

describe('submitAnswer errors', () => {
  it.each<[string, QuizConfig, SubmittedAnswer, string]>([
    [
      'text in Easy mode',
      fixedEasy,
      { kind: 'text', text: 'Paris' },
      'answer-kind-mismatch',
    ],
    [
      'choice in Hard mode',
      { ...fixedEasy, difficulty: 'hard' },
      { kind: 'choice', countryCode: 'fr' },
      'answer-kind-mismatch',
    ],
    [
      'blank text',
      { ...fixedEasy, difficulty: 'hard' },
      { kind: 'text', text: '   ' },
      'empty-answer',
    ],
    [
      'choice that was not offered',
      { ...fixedEasy, scope: 'europe' },
      { kind: 'choice', countryCode: 'au' },
      'invalid-choice',
    ],
  ])('%s', (_, config, submitted, error) => {
    const session = start(config);
    const result = engine.submitAnswer(session, submitted, T0 + 1);
    expect(result).toEqual({ ok: false, error, session });
  });

  it('rejects answers after the session finished', () => {
    const session = engine.stop(start(fixedEasy), T0 + 1);
    expect(
      engine.submitAnswer(
        session,
        { kind: 'choice', countryCode: 'fr' },
        T0 + 2,
      ),
    ).toMatchObject({
      ok: false,
      error: 'session-finished',
    });
  });

  it('rejects timestamps that go backwards', () => {
    let session = start(fixedEasy);
    session = answer(session, correctAnswer(session), T0 + 5_000);

    expect(
      engine.submitAnswer(session, correctAnswer(session), T0 + 4_999),
    ).toMatchObject({
      ok: false,
      error: 'timestamp-out-of-order',
    });
    expect(
      engine.submitAnswer(
        start(fixedEasy),
        correctAnswer(start(fixedEasy)),
        T0 - 1,
      ),
    ).toMatchObject({
      ok: false,
      error: 'timestamp-out-of-order',
    });
  });
});

describe('Endless mode', () => {
  const endless: QuizConfig = {
    ...fixedEasy,
    mode: 'endless',
    scope: 'europe',
  };

  it('continues past the pool size until stopped', () => {
    let session = start(endless);
    for (let i = 0; i < 25; i++) {
      session = answer(
        session,
        i % 3 === 0 ? wrongAnswer(session) : correctAnswer(session),
        T0 + i * 100,
      );
    }
    expect(session.status).toBe('active');

    session = engine.stop(session, T0 + 10_000);
    expect(session).toMatchObject({
      endReason: 'stopped',
      finishedAt: T0 + 10_000,
    });
    expect(engine.summarize(session)).toMatchObject({
      totalQuestions: null,
      answered: 25,
      correct: 16,
      incorrect: 9,
      completed: false,
    });
  });

  it('never finishes before the last answer when stopped with an older timestamp', () => {
    let session = start(endless);
    session = answer(session, correctAnswer(session), T0 + 5_000);
    expect(engine.stop(session, T0 + 1_000).finishedAt).toBe(T0 + 5_000);
  });

  it('has no timer', () => {
    expect(engine.remainingTimeMs(start(endless), T0 + 999_999)).toBeNull();
  });
});

describe('Timed mode', () => {
  const timed: QuizConfig = { ...fixedEasy, mode: 'timed' };
  const deadline = T0 + TIMED_MODE_DURATION_MS;

  it('reports remaining time from the clock, not from ticks', () => {
    const session = start(timed);
    expect(engine.remainingTimeMs(session, T0)).toBe(60_000);
    expect(engine.remainingTimeMs(session, T0 + 59_250)).toBe(750);
    expect(engine.remainingTimeMs(session, T0 + 3_600_000)).toBe(0);
  });

  it('accepts answers until the deadline and rejects them at or after it', () => {
    let session = start(timed);
    session = answer(session, correctAnswer(session), deadline - 1);

    const late = engine.submitAnswer(session, correctAnswer(session), deadline);
    expect(late.ok).toBe(false);
    expect(late).toMatchObject({
      error: 'time-up',
      session: {
        status: 'finished',
        endReason: 'time-up',
        finishedAt: deadline,
      },
    });
    expect(late.session.answers).toHaveLength(1);
  });

  it('finalizes at the deadline even if the app resumes much later (backgrounding)', () => {
    let session = start(timed);
    session = answer(session, correctAnswer(session), T0 + 10_000);
    session = answer(session, wrongAnswer(session), T0 + 20_000);

    const resumed = engine.expire(session, T0 + 10 * 60_000);
    expect(resumed).toMatchObject({
      endReason: 'time-up',
      finishedAt: deadline,
    });
    expect(engine.summarize(resumed)).toMatchObject({
      correct: 1,
      incorrect: 1,
      durationMs: 60_000,
      completed: false,
    });
    expect(engine.remainingTimeMs(resumed, T0 + 10 * 60_000)).toBe(0);
  });

  it('does not expire early', () => {
    const session = start(timed);
    expect(engine.expire(session, deadline - 1)).toBe(session);
  });

  it('turns a late stop into time-up', () => {
    expect(engine.stop(start(timed), deadline + 5)).toMatchObject({
      endReason: 'time-up',
      finishedAt: deadline,
    });
    expect(engine.stop(start(timed), T0 + 30_000)).toMatchObject({
      endReason: 'stopped',
      finishedAt: T0 + 30_000,
    });
  });
});

describe('Challenge mode', () => {
  it('asks every country exactly once and completes after the last one', () => {
    let session = start({ ...fixedEasy, mode: 'challenge' });
    expect(engine.questions(session).length).toBe(FIXTURE_DATASET.length);

    for (let i = 0; i < FIXTURE_DATASET.length; i++) {
      session = answer(session, correctAnswer(session), T0 + (i + 1) * 1_000);
    }

    expect(session.endReason).toBe('completed');
    expect(new Set(session.answers.map((a) => a.countryCode)).size).toBe(
      FIXTURE_DATASET.length,
    );
    expect(engine.summarize(session)).toMatchObject({
      perfect: true,
      durationMs: FIXTURE_DATASET.length * 1_000,
    });
  });

  it('uses the same question order for the same seed (comparable runs)', () => {
    const order = (seed: string) => {
      const session = start({ ...fixedEasy, mode: 'challenge' }, seed);
      return Array.from({ length: FIXTURE_DATASET.length }, (_, i) =>
        engine.questions(session).questionAt(i),
      );
    };
    expect(order('weekly-1')).toEqual(order('weekly-1'));
  });
});

describe('replay (server-side re-validation)', () => {
  function play(
    config: QuizConfig,
    steps: ('right' | 'wrong')[],
    seed = 'replay',
  ) {
    let session = start(config, seed);
    const submissions: SessionRecord['submissions'][number][] = [];
    steps.forEach((step, i) => {
      const submitted =
        step === 'right' ? correctAnswer(session) : wrongAnswer(session);
      const answeredAt = T0 + (i + 1) * 1_000;
      submissions.push({ answer: submitted, answeredAt });
      session = answer(session, submitted, answeredAt);
    });
    return { session, submissions };
  }

  it('reproduces a completed session and its grading', () => {
    const { session, submissions } = play({ ...fixedEasy, questionCount: 3 }, [
      'right',
      'wrong',
      'right',
    ]);
    const replayed = engine.replay({
      config: session.config,
      seed: session.seed,
      startedAt: T0,
      finishedAt: session.finishedAt as number,
      endReason: 'completed',
      submissions,
    });

    expect(replayed).toEqual({ ok: true, value: session });
  });

  it('ignores any score the client might claim: grading comes from the answers', () => {
    const { session, submissions } = play({ ...fixedEasy, questionCount: 2 }, [
      'wrong',
      'wrong',
    ]);
    const replayed = engine.replay({
      config: session.config,
      seed: session.seed,
      startedAt: T0,
      finishedAt: session.finishedAt as number,
      endReason: 'completed',
      submissions,
    });

    expect(replayed.ok && engine.summarize(replayed.value).correct).toBe(0);
  });

  it('rejects a record whose answers were not offered for the regenerated questions', () => {
    const { session, submissions } = play({ ...fixedEasy, questionCount: 2 }, [
      'right',
      'right',
    ]);
    const replayed = engine.replay({
      config: session.config,
      seed: 'a-different-seed',
      startedAt: T0,
      finishedAt: session.finishedAt as number,
      endReason: 'completed',
      submissions,
    });

    expect(replayed.ok).toBe(false);
  });

  it.each<[string, Partial<SessionRecord>]>([
    ['claims completion with missing answers', { endReason: 'completed' }],
    [
      'finishes before its last answer',
      { endReason: 'stopped', finishedAt: T0 + 500 },
    ],
    ['claims time-up for a non-timed session', { endReason: 'time-up' }],
  ])('rejects a record that %s', (_, override) => {
    const { session, submissions } = play(fixedEasy, ['right', 'right']);
    const record: SessionRecord = {
      config: session.config,
      seed: session.seed,
      startedAt: T0,
      finishedAt: T0 + 3_000,
      endReason: 'stopped',
      submissions,
      ...override,
    };
    expect(engine.replay(record)).toEqual({
      ok: false,
      error: { kind: 'inconsistent-ending' },
    });
  });

  it('rejects extra answers after completion and answers after the timer', () => {
    const { session, submissions } = play({ ...fixedEasy, questionCount: 1 }, [
      'right',
    ]);
    expect(
      engine.replay({
        config: session.config,
        seed: session.seed,
        startedAt: T0,
        finishedAt: T0 + 2_000,
        endReason: 'completed',
        submissions: [
          ...submissions,
          { answer: submissions[0]!.answer, answeredAt: T0 + 2_000 },
        ],
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'invalid-submission',
        index: 1,
        reason: 'session-finished',
      },
    });

    expect(
      engine.replay({
        config: { ...fixedEasy, mode: 'timed' },
        seed: 'late',
        startedAt: T0,
        finishedAt: T0 + 61_000,
        endReason: 'time-up',
        submissions: [
          {
            answer: { kind: 'choice', countryCode: 'fr' },
            answeredAt: T0 + 61_000,
          },
        ],
      }),
    ).toEqual({
      ok: false,
      error: { kind: 'invalid-submission', index: 0, reason: 'time-up' },
    });
  });

  it('accepts a timed session that ran out of time', () => {
    const { session, submissions } = play({ ...fixedEasy, mode: 'timed' }, [
      'right',
      'wrong',
    ]);
    const replayed = engine.replay({
      config: session.config,
      seed: session.seed,
      startedAt: T0,
      finishedAt: T0 + 60_000,
      endReason: 'time-up',
      submissions,
    });
    expect(replayed.ok && replayed.value).toMatchObject({
      endReason: 'time-up',
      finishedAt: T0 + 60_000,
    });
  });

  it('rejects an invalid config', () => {
    expect(
      engine.replay({
        config: { ...fixedEasy, mode: 'challenge', scope: 'asia' },
        seed: 's',
        startedAt: T0,
        finishedAt: T0,
        endReason: 'completed',
        submissions: [],
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'invalid-config',
        reason: 'challenge-requires-world-scope',
      },
    });
  });
});
