import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  newlyUnlockedAchievements,
} from './achievements';
import type { ProgressEvent } from './progress';
import { rebuildProgress } from './progress';

const masterEvents = (
  codes: readonly string[],
  category: 'capitals' | 'flags',
): ProgressEvent[] =>
  codes.flatMap((countryCode, i) => [
    {
      category,
      countryCode,
      difficulty: 'hard',
      correct: true,
      answeredAt: i + 1,
      sessionId: 's',
      sequence: i * 2,
    },
    {
      category,
      countryCode,
      difficulty: 'hard',
      correct: true,
      answeredAt: i + 1,
      sessionId: 's',
      sequence: i * 2 + 1,
    },
  ]);

const status = (progress: ReturnType<typeof rebuildProgress>, id: string) =>
  evaluateAchievements(FIXTURE_DATASET, progress).find(
    (a) => a.achievement.id === id,
  );

describe('ACHIEVEMENTS', () => {
  it('defines regional and World mastery per category (14), no generic achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(14);
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'capitals-europe-mastered',
      'capitals-asia-mastered',
      'capitals-africa-mastered',
      'capitals-north-america-mastered',
      'capitals-south-america-mastered',
      'capitals-oceania-mastered',
      'capitals-world-mastered',
      'flags-europe-mastered',
      'flags-asia-mastered',
      'flags-africa-mastered',
      'flags-north-america-mastered',
      'flags-south-america-mastered',
      'flags-oceania-mastered',
      'flags-world-mastered',
    ]);
  });
});

describe('evaluateAchievements', () => {
  it('is locked with no progress, with totals taken from the dataset', () => {
    expect(status(new Map(), 'capitals-europe-mastered')).toMatchObject({
      status: 'locked',
      mastered: 0,
      total: 9,
    });
  });

  it('is in progress once at least one country is mastered', () => {
    const progress = rebuildProgress(masterEvents(['fr'], 'capitals'));
    expect(status(progress, 'capitals-europe-mastered')).toMatchObject({
      status: 'in-progress',
      mastered: 1,
    });
  });

  it('unlocks when every country of the scope is mastered, per category', () => {
    const progress = rebuildProgress(masterEvents(['bo', 'br'], 'flags'));
    expect(status(progress, 'flags-south-america-mastered')?.status).toBe(
      'unlocked',
    );
    expect(status(progress, 'capitals-south-america-mastered')?.status).toBe(
      'locked',
    );
    expect(status(progress, 'flags-world-mastered')).toMatchObject({
      status: 'in-progress',
      mastered: 2,
    });
  });

  it('unlocks World only when all countries are mastered', () => {
    const progress = rebuildProgress(
      masterEvents(
        FIXTURE_DATASET.map((c) => c.code),
        'capitals',
      ),
    );
    const unlocked = evaluateAchievements(FIXTURE_DATASET, progress)
      .filter((a) => a.status === 'unlocked')
      .map((a) => a.achievement.id);
    expect(unlocked).toHaveLength(7);
    expect(unlocked).toContain('capitals-world-mastered');
  });

  it('is not unlocked for a scope with no countries', () => {
    const noOceania = FIXTURE_DATASET.filter((c) => c.region !== 'oceania');
    const result = evaluateAchievements(noOceania, new Map()).find(
      (a) => a.achievement.id === 'capitals-oceania-mastered',
    );
    expect(result).toMatchObject({ status: 'locked', total: 0 });
  });
});

describe('newlyUnlockedAchievements', () => {
  it('returns only achievements that became unlocked', () => {
    const before = evaluateAchievements(
      FIXTURE_DATASET,
      rebuildProgress(masterEvents(['bo'], 'flags')),
    );
    const after = evaluateAchievements(
      FIXTURE_DATASET,
      rebuildProgress(masterEvents(['bo', 'br'], 'flags')),
    );

    expect(newlyUnlockedAchievements(before, after).map((a) => a.id)).toEqual([
      'flags-south-america-mastered',
    ]);
    expect(newlyUnlockedAchievements(after, after)).toEqual([]);
  });
});
