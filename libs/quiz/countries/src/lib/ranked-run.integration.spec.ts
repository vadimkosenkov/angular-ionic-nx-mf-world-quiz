import type { QuizConfig, SessionRecord } from '@world-quiz/quiz/domain';
import {
  createQuizEngine,
  DEFAULT_FIXED_QUESTION_COUNT,
  evaluateRankedRun,
  indexCountriesByCode,
} from '@world-quiz/quiz/domain';
import { COUNTRIES } from './countries.data';

/**
 * End-to-end domain scenario on the real dataset: a player plays a flawless
 * Hard quick round over Europe in Russian, and the server re-validates the
 * uploaded record from scratch before putting it on a board.
 */
describe('a ranked run on the real dataset', () => {
  const engine = createQuizEngine(COUNTRIES);
  const countries = indexCountriesByCode(COUNTRIES);
  const config: QuizConfig = {
    category: 'flags',
    difficulty: 'hard',
    mode: 'fixed',
    scope: 'europe',
  };
  const T0 = Date.UTC(2026, 8, 16);

  it('ranks a flawless quick round after a server-side replay', () => {
    const started = engine.start(config, {
      seed: 'europe-fast',
      startedAt: T0,
    });
    if (!started.ok) throw new Error(started.error);

    let session = started.value;
    const submissions: SessionRecord['submissions'][number][] = [];
    for (let i = 0; i < DEFAULT_FIXED_QUESTION_COUNT; i++) {
      const question = engine.currentQuestion(session);
      if (!question) throw new Error('the round ended early');
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
    const evaluation = evaluateRankedRun(
      replayed.value,
      engine.summarize(replayed.value),
    );

    expect(evaluation).toEqual({
      eligible: true,
      board: {
        id: 'flags-hard-europe-fixed',
        category: 'flags',
        difficulty: 'hard',
        scope: 'europe',
        mode: 'fixed',
        metric: 'time',
      },
      score: {
        value: DEFAULT_FIXED_QUESTION_COUNT * 2_000,
        timeMs: DEFAULT_FIXED_QUESTION_COUNT * 2_000,
      },
    });
  });

  it('keeps the same run off the board if one answer is wrong', () => {
    const started = engine.start(config, {
      seed: 'europe-slip',
      startedAt: T0,
    });
    if (!started.ok) throw new Error(started.error);

    let session = started.value;
    for (let i = 0; i < DEFAULT_FIXED_QUESTION_COUNT; i++) {
      const question = engine.currentQuestion(session);
      if (!question) throw new Error('the round ended early');
      const text =
        i === 4 ? 'Атлантида' : countries.get(question.countryCode)!.name.en;
      const result = engine.submitAnswer(
        session,
        { kind: 'text', text },
        T0 + i + 1,
      );
      if (!result.ok) throw new Error(result.error);
      session = result.session;
    }

    expect(evaluateRankedRun(session, engine.summarize(session))).toEqual({
      eligible: false,
      reason: 'has-incorrect-answers',
    });
  });
});
