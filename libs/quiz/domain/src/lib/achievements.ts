import type { CountryDataset } from './country';
import type { ProgressMap } from './progress';
import { scopeProgress } from './progress';
import type { QuizCategory, QuizScope } from './vocabulary';
import { QUIZ_CATEGORIES, REGIONS } from './vocabulary';

/**
 * Achievements represent learning progress only: "every country of a scope is
 * mastered in a category". One per category × (six regions + World) = 14.
 * Totals always come from the dataset, never from hard-coded counts.
 */
export interface AchievementDefinition {
  readonly id: `${QuizCategory}-${QuizScope}-mastered`;
  readonly category: QuizCategory;
  readonly scope: QuizScope;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] =
  QUIZ_CATEGORIES.flatMap((category) =>
    [...REGIONS, 'world' as const].map((scope): AchievementDefinition => ({
      id: `${category}-${scope}-mastered`,
      category,
      scope,
    })),
  );

export type AchievementStatus = 'locked' | 'in-progress' | 'unlocked';

export interface AchievementProgress {
  readonly achievement: AchievementDefinition;
  readonly status: AchievementStatus;
  readonly mastered: number;
  readonly total: number;
}

export function evaluateAchievements(
  dataset: CountryDataset,
  progress: ProgressMap,
): AchievementProgress[] {
  return ACHIEVEMENTS.map((achievement) => {
    const { mastered, total } = scopeProgress(
      dataset,
      progress,
      achievement.category,
      achievement.scope,
    );
    const status: AchievementStatus =
      total > 0 && mastered === total
        ? 'unlocked'
        : mastered > 0
          ? 'in-progress'
          : 'locked';
    return { achievement, status, mastered, total };
  });
}

/** Achievements unlocked by moving from `before` to `after` (for the "unlocked!" feedback). */
export function newlyUnlockedAchievements(
  before: readonly AchievementProgress[],
  after: readonly AchievementProgress[],
): AchievementDefinition[] {
  const unlockedBefore = new Set(
    before
      .filter((entry) => entry.status === 'unlocked')
      .map((entry) => entry.achievement.id),
  );
  return after
    .filter(
      (entry) =>
        entry.status === 'unlocked' &&
        !unlockedBefore.has(entry.achievement.id),
    )
    .map((entry) => entry.achievement);
}
