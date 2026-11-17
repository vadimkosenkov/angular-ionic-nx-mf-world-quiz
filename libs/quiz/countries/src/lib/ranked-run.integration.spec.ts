import type { QuizConfig, SessionRecord } from '@world-quiz/quiz/domain';
import {
  createQuizEngine,
  evaluateChallengeRun,
  indexCountriesByCode,
} from '@world-quiz/quiz/domain';
import { COUNTRIES } from './countries.data';

/**
 * End-to-end domain scenario on the real dataset: a client plays a full
 * Hard "perfect run" in Russian, and the server re-validates the submitted
 * record from scratch before ranking it.
 */
describe('leaderboard challenge on the real dataset', () => {
  const engine = createQuizEngine(COUNTRIES);
  const countries = indexCountriesByCode(COUNTRIES);
  const config: QuizConfig = {
    category: 'flags',
    difficulty: 'hard',
    mode: 'challenge',
    scope: 'world',
  };
  const T0 = Date.UTC(2026, 8, 16);

  it('accepts a perfect 195-question run after server-side replay', () => {
    const started = engine.start(config, {
      seed: 'challenge-2026-09-16',
      startedAt: T0,
    });
    if (!started.ok) throw new Error(started.error);

    let session = started.value;
    const submissions: SessionRecord['submissions'][number][] = [];
    for (let i = 0; i < COUNTRIES.length; i++) {
      const question = engine.currentQuestion(session)!;
      const answer = {
        kind: 'text',
        text: countries.get(question.countryCode)!.name.ru,
      } as const;
      const answeredAt = T0 + (i + 1) * 2_000;
      const result = engine.submitAnswer(session, answer, answeredAt);
      if (!result.ok) throw new Error(result.error);
      submissions.push({ answer, answeredAt });
      session = result.session;
    }

    // What the client would upload:
    const record: SessionRecord = {
      config,
      seed: session.seed,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt!,
      endReason: 'completed',
      submissions,
    };

    // What the server does:
    const replayed = engine.replay(record);
    if (!replayed.ok) throw new Error(JSON.stringify(replayed.error));
    const evaluation = evaluateChallengeRun(
      replayed.value,
      engine.summarize(replayed.value),
      COUNTRIES,
    );

    expect(evaluation).toEqual({
      eligible: true,
      board: {
        id: 'flags-hard',
        category: 'flags',
        difficulty: 'hard',
        scope: 'world',
      },
      completionTimeMs: 195 * 2_000,
    });
  });

  it('rejects the same run if one answer is wrong', () => {
    const started = engine.start(config, {
      seed: 'challenge-wrong',
      startedAt: T0,
    });
    if (!started.ok) throw new Error(started.error);

    let session = started.value;
    for (let i = 0; i < COUNTRIES.length; i++) {
      const question = engine.currentQuestion(session)!;
      const text =
        i === 100 ? 'Атлантида' : countries.get(question.countryCode)!.name.en;
      const result = engine.submitAnswer(
        session,
        { kind: 'text', text },
        T0 + i + 1,
      );
      if (!result.ok) throw new Error(result.error);
      session = result.session;
    }

    expect(
      evaluateChallengeRun(session, engine.summarize(session), COUNTRIES),
    ).toEqual({
      eligible: false,
      reason: 'has-incorrect-answers',
    });
  });
});
