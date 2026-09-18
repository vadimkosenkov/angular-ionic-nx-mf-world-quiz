import { InjectionToken } from '@angular/core';
import type { Routes } from '@angular/router';
import { COUNTRIES } from '@world-quiz/quiz/countries';
import type {
  AchievementDefinition,
  CountryCode,
  CountryDataset,
  QuizCategory,
  QuizScope,
  QuizSession,
  ScopeProgress,
  SessionSummary,
} from '@world-quiz/quiz/domain';
import { type Clock, systemClock } from '@world-quiz/shared/util';

/**
 * The contract between the shell and the quiz microfrontends.
 *
 * A remote plays a quiz and hands the finished session to the shell. It never
 * knows how progress is stored, synchronized or ranked; the shell provides the
 * implementations on the federated route. This keeps the coupling to routing
 * plus these few interfaces (docs/architecture/microfrontends.md).
 */

/** The country dataset. Injected so tests and previews can use a smaller one. */
export const COUNTRY_DATASET = new InjectionToken<CountryDataset>(
  'COUNTRY_DATASET',
  { providedIn: 'root', factory: () => COUNTRIES },
);

/**
 * Wall clock for quiz timing.
 *
 * Browsers get a monotonic clock so a device clock change cannot move quiz
 * time backwards; tests inject a manual clock.
 */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => monotonicClock ?? systemClock,
});

const monotonicClock: Clock | null =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? { now: () => performance.timeOrigin + performance.now() }
    : null;

/**
 * The module every quiz remote exposes as `./routes`.
 *
 * Federated modules are loaded at runtime, so the host cannot import the
 * remote's source for its type: this interface is the contract both sides
 * compile against instead.
 */
export interface QuizRemoteRoutesModule {
  readonly remoteRoutes: Routes;
}

/** What the shell reports back after recording a finished session. */
export interface QuizSessionOutcome {
  /** Achievements that were locked or in progress before and are unlocked now. */
  readonly newlyUnlocked: readonly AchievementDefinition[];
  /** Countries that still need practice in this category after the session. */
  readonly mistakes: readonly CountryCode[];
}

/** Where a remote sends a finished quiz session. */
export interface QuizResultSink {
  submit(session: QuizSession, summary: SessionSummary): QuizSessionOutcome;
}

export const QUIZ_RESULT_SINK = new InjectionToken<QuizResultSink>(
  'QUIZ_RESULT_SINK',
);

/** Read-only view of the player's progress, for setup screens and practice. */
export interface QuizProgressReader {
  mistakes(category: QuizCategory): readonly CountryCode[];
  scopeProgress(category: QuizCategory, scope: QuizScope): ScopeProgress;
}

export const QUIZ_PROGRESS_READER = new InjectionToken<QuizProgressReader>(
  'QUIZ_PROGRESS_READER',
);
