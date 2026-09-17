import { computed, inject, Injectable, signal } from '@angular/core';
import {
  applyProgressEvents,
  evaluateAchievements,
  practiceCandidates,
  type ProgressEvent,
  type ProgressMap,
  QUIZ_CATEGORIES,
  type QuizCategory,
  type QuizScope,
  REGIONS,
  scopeProgress,
} from '@world-quiz/quiz/domain';
import { COUNTRY_DATASET } from './tokens';

/**
 * Learning progress for the current user, exposed as signals.
 *
 * All numbers are derived from the dataset and the domain rules, never
 * hard-coded. Until the offline-persistence phase, progress lives only in
 * memory, so a fresh app start shows zero progress; the quiz phases call
 * `record()` after each session.
 */
@Injectable({ providedIn: 'root' })
export class ProgressStore {
  readonly dataset = inject(COUNTRY_DATASET);
  private readonly progress = signal<ProgressMap>(new Map());

  readonly countryCount = this.dataset.length;
  readonly regionCount = REGIONS.filter((region) =>
    this.dataset.some((country) => country.region === region),
  ).length;

  readonly achievements = computed(() =>
    evaluateAchievements(this.dataset, this.progress()),
  );

  readonly unlockedAchievements = computed(
    () =>
      this.achievements().filter((entry) => entry.status === 'unlocked').length,
  );

  /** Mastered countries per category for the whole world. */
  readonly worldProgress = computed(
    () =>
      Object.fromEntries(
        QUIZ_CATEGORIES.map((category) => [
          category,
          scopeProgress(this.dataset, this.progress(), category, 'world'),
        ]),
      ) as Record<QuizCategory, ReturnType<typeof scopeProgress>>,
  );

  /** Capitals + Flags mastered, out of both categories combined. */
  readonly combinedProgress = computed(() => {
    const perCategory = Object.values(this.worldProgress());
    const mastered = perCategory.reduce(
      (sum, entry) => sum + entry.mastered,
      0,
    );
    const total = perCategory.reduce((sum, entry) => sum + entry.total, 0);
    return {
      mastered,
      total,
      percent: total === 0 ? 0 : Math.round((mastered / total) * 100),
    };
  });

  readonly mistakeCount = computed(() =>
    QUIZ_CATEGORIES.reduce(
      (sum, category) =>
        sum +
        practiceCandidates(this.dataset, this.progress(), category).length,
      0,
    ),
  );

  scope(category: QuizCategory, scope: QuizScope) {
    return scopeProgress(this.dataset, this.progress(), category, scope);
  }

  /** Applies answered questions (in order) to the progress. */
  record(events: readonly ProgressEvent[]): void {
    this.progress.update((current) => applyProgressEvents(current, events));
  }
}
