import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import { isMastered } from './mastery';
import type { ProgressEvent } from './progress';
import {
  applyProgressEvents,
  compareProgressEvents,
  masteryOf,
  practiceCandidates,
  progressByScope,
  progressKey,
  rebuildProgress,
  scopeProgress,
  sessionProgressEvents,
} from './progress';
import { createQuizEngine } from './session';

const event = (overrides: Partial<ProgressEvent>): ProgressEvent => ({
  category: 'capitals',
  countryCode: 'fr',
  difficulty: 'hard',
  correct: true,
  answeredAt: 1,
  sessionId: 's1',
  sequence: 0,
  ...overrides,
});

const masterAll = (
  codes: readonly string[],
  category: 'capitals' | 'flags' = 'capitals',
) =>
  codes.flatMap((countryCode, i) => [
    event({ category, countryCode, answeredAt: i * 2 + 1 }),
    event({ category, countryCode, difficulty: 'easy', answeredAt: i * 2 + 2 }),
  ]);

describe('progress keys and lookup', () => {
  it('keys progress by category and country', () => {
    expect(progressKey('flags', 'fr')).toBe('flags:fr');
  });

  it('returns the initial state for unseen countries', () => {
    expect(masteryOf(new Map(), 'capitals', 'fr').points).toBe(0);
  });

  it('keeps categories independent', () => {
    const progress = applyProgressEvents(new Map(), masterAll(['fr']));
    expect(isMastered(masteryOf(progress, 'capitals', 'fr'))).toBe(true);
    expect(isMastered(masteryOf(progress, 'flags', 'fr'))).toBe(false);
  });
});

describe('rebuildProgress', () => {
  const events: ProgressEvent[] = [
    event({ answeredAt: 10, correct: true, difficulty: 'hard' }),
    event({ answeredAt: 20, correct: false }),
    event({ answeredAt: 30, correct: true, difficulty: 'easy' }),
  ];

  it('orders events canonically, so late-synced answers give the same result', () => {
    const inOrder = rebuildProgress(events);
    const shuffledOrder = rebuildProgress([events[2]!, events[0]!, events[1]!]);

    expect(shuffledOrder).toEqual(inOrder);
    expect(masteryOf(inOrder, 'capitals', 'fr')).toMatchObject({
      points: 1,
      everWrong: true,
    });
  });

  it('breaks timestamp ties by session id, then sequence', () => {
    const a = event({ answeredAt: 5, sessionId: 'a', sequence: 1 });
    const b = event({ answeredAt: 5, sessionId: 'a', sequence: 2 });
    const c = event({ answeredAt: 5, sessionId: 'b', sequence: 0 });
    expect([c, b, a].sort(compareProgressEvents)).toEqual([a, b, c]);
  });

  it('applies events in the given order when appending (does not mutate input)', () => {
    const base = rebuildProgress([event({ answeredAt: 1 })]);
    const next = applyProgressEvents(base, [
      event({ answeredAt: 2, correct: false }),
    ]);

    expect(masteryOf(base, 'capitals', 'fr').points).toBe(2);
    expect(masteryOf(next, 'capitals', 'fr').points).toBe(0);
  });
});

describe('sessionProgressEvents', () => {
  it('turns every answer of a session into an ordered event', () => {
    const engine = createQuizEngine(FIXTURE_DATASET);
    const started = engine.start(
      {
        category: 'flags',
        difficulty: 'easy',
        mode: 'fixed',
        scope: 'world',
        questionCount: 2,
      },
      { seed: 'events', startedAt: 0 },
    );
    if (!started.ok) throw new Error(started.error);
    let session = started.value;
    for (const at of [100, 200]) {
      const question = engine.currentQuestion(session)!;
      const result = engine.submitAnswer(
        session,
        { kind: 'choice', countryCode: question.countryCode },
        at,
      );
      if (!result.ok) throw new Error(result.error);
      session = result.session;
    }

    const events = sessionProgressEvents(session, 'session-42');
    expect(events).toEqual([
      expect.objectContaining({
        category: 'flags',
        difficulty: 'easy',
        correct: true,
        answeredAt: 100,
        sessionId: 'session-42',
        sequence: 0,
      }),
      expect.objectContaining({ answeredAt: 200, sequence: 1 }),
    ]);
    expect(events.map((e) => e.countryCode)).toEqual(
      session.answers.map((a) => a.countryCode),
    );
  });
});

describe('scope progress', () => {
  const progress = rebuildProgress(masterAll(['bo', 'br', 'fr']));

  it('counts mastered countries against dataset totals', () => {
    expect(
      scopeProgress(FIXTURE_DATASET, progress, 'capitals', 'south-america'),
    ).toEqual({
      scope: 'south-america',
      mastered: 2,
      total: 2,
    });
    expect(
      scopeProgress(FIXTURE_DATASET, progress, 'capitals', 'world'),
    ).toEqual({
      scope: 'world',
      mastered: 3,
      total: FIXTURE_DATASET.length,
    });
  });

  it('breaks progress down by World and each region', () => {
    const breakdown = progressByScope(FIXTURE_DATASET, progress, 'capitals');
    expect(breakdown.map((p) => p.scope)).toEqual([
      'world',
      'europe',
      'asia',
      'africa',
      'north-america',
      'south-america',
      'oceania',
    ]);
    expect(breakdown.find((p) => p.scope === 'europe')).toMatchObject({
      mastered: 1,
      total: 9,
    });
  });
});

describe('practiceCandidates', () => {
  it('lists countries answered wrong and not re-mastered, most recent mistake first', () => {
    const progress = rebuildProgress([
      event({ countryCode: 'fr', correct: false, answeredAt: 10 }),
      event({ countryCode: 'de', correct: false, answeredAt: 30 }),
      event({ countryCode: 'jp', correct: false, answeredAt: 20 }),
      // Japan is fixed afterwards: two Hard answers = 4 points → mastered.
      event({ countryCode: 'jp', answeredAt: 40 }),
      event({ countryCode: 'jp', answeredAt: 50 }),
      // A mistake in another category does not appear here.
      event({
        category: 'flags',
        countryCode: 'it',
        correct: false,
        answeredAt: 60,
      }),
      // Correct-only history is not a mistake.
      event({ countryCode: 'at', answeredAt: 70 }),
    ]);

    expect(practiceCandidates(FIXTURE_DATASET, progress, 'capitals')).toEqual([
      'de',
      'fr',
    ]);
    expect(practiceCandidates(FIXTURE_DATASET, progress, 'flags')).toEqual([
      'it',
    ]);
  });

  it('keeps an item in practice until it is mastered again', () => {
    const partlyFixed = rebuildProgress([
      event({ countryCode: 'fr', correct: false, answeredAt: 1 }),
      event({ countryCode: 'fr', difficulty: 'easy', answeredAt: 2 }),
      event({ countryCode: 'fr', difficulty: 'easy', answeredAt: 3 }),
    ]);
    expect(
      practiceCandidates(FIXTURE_DATASET, partlyFixed, 'capitals'),
    ).toEqual(['fr']);
  });

  it('is empty when there are no mistakes', () => {
    expect(practiceCandidates(FIXTURE_DATASET, new Map(), 'capitals')).toEqual(
      [],
    );
  });
});
