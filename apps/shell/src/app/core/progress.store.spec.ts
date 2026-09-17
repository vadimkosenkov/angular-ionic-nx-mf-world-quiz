import { TestBed } from '@angular/core/testing';
import type { ProgressEvent } from '@world-quiz/quiz/domain';
import { ProgressStore } from './progress.store';

const correctHard = (
  countryCode: string,
  category: 'capitals' | 'flags',
  i: number,
): ProgressEvent[] => [
  {
    category,
    countryCode,
    difficulty: 'hard',
    correct: true,
    answeredAt: i * 2 + 1,
    sessionId: 's',
    sequence: i * 2,
  },
  {
    category,
    countryCode,
    difficulty: 'hard',
    correct: true,
    answeredAt: i * 2 + 2,
    sessionId: 's',
    sequence: i * 2 + 1,
  },
];

describe('ProgressStore', () => {
  let store: ProgressStore;

  beforeEach(() => {
    store = TestBed.inject(ProgressStore);
  });

  it('derives counts from the real dataset', () => {
    expect(store.countryCount).toBe(195);
    expect(store.regionCount).toBe(6);
    expect(store.achievements()).toHaveLength(14);
  });

  it('starts with zero progress', () => {
    expect(store.combinedProgress()).toEqual({
      mastered: 0,
      total: 390,
      percent: 0,
    });
    expect(store.unlockedAchievements()).toBe(0);
    expect(store.mistakeCount()).toBe(0);
  });

  it('updates progress, achievements and mistakes when answers are recorded', () => {
    const southAmerica = store.dataset
      .filter((c) => c.region === 'south-america')
      .map((c) => c.code);
    store.record(
      southAmerica.flatMap((code, i) => correctHard(code, 'flags', i)),
    );
    store.record([
      {
        category: 'capitals',
        countryCode: 'fr',
        difficulty: 'easy',
        correct: false,
        answeredAt: 100,
        sessionId: 't',
        sequence: 0,
      },
    ]);

    expect(store.worldProgress().flags).toMatchObject({
      mastered: 12,
      total: 195,
    });
    expect(store.combinedProgress()).toEqual({
      mastered: 12,
      total: 390,
      percent: 3,
    });
    expect(store.unlockedAchievements()).toBe(1);
    expect(store.scope('flags', 'south-america')).toMatchObject({
      mastered: 12,
      total: 12,
    });
    expect(store.mistakeCount()).toBe(1);
  });
});
