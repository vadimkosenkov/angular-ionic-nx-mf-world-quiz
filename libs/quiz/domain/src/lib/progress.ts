import type { CountryCode, CountryDataset } from './country';
import { countriesInScope } from './country';
import type { MasteryState } from './mastery';
import {
  applyMasteryAnswer,
  INITIAL_MASTERY,
  isMastered,
  isMistake,
} from './mastery';
import type { QuizSession } from './session';
import type { Difficulty, QuizCategory, QuizScope } from './vocabulary';
import { QUIZ_SCOPES } from './vocabulary';

/**
 * Learning progress: one `MasteryState` per category × country.
 *
 * Every answered question (training, practice or challenge) is a
 * `ProgressEvent`. Progress is a pure fold over events, so the server can
 * rebuild it deterministically when answers from several offline devices
 * arrive out of order.
 */
export type ProgressKey = `${QuizCategory}:${CountryCode}`;
export type ProgressMap = ReadonlyMap<ProgressKey, MasteryState>;

export function progressKey(
  category: QuizCategory,
  countryCode: CountryCode,
): ProgressKey {
  return `${category}:${countryCode}`;
}

export function masteryOf(
  progress: ProgressMap,
  category: QuizCategory,
  countryCode: CountryCode,
): MasteryState {
  return progress.get(progressKey(category, countryCode)) ?? INITIAL_MASTERY;
}

export interface ProgressEvent {
  readonly category: QuizCategory;
  readonly countryCode: CountryCode;
  readonly difficulty: Difficulty;
  readonly correct: boolean;
  readonly answeredAt: number;
  /** Tie-breakers that make the ordering total and deterministic. */
  readonly sessionId: string;
  readonly sequence: number;
}

/** Canonical event order: answer time, then session id, then position in session. */
export function compareProgressEvents(
  a: ProgressEvent,
  b: ProgressEvent,
): number {
  return (
    a.answeredAt - b.answeredAt ||
    (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0) ||
    a.sequence - b.sequence
  );
}

/** Applies events in the given order on top of existing progress. */
export function applyProgressEvents(
  progress: ProgressMap,
  events: readonly ProgressEvent[],
): ProgressMap {
  const next = new Map(progress);
  for (const event of events) {
    const key = progressKey(event.category, event.countryCode);
    next.set(key, applyMasteryAnswer(next.get(key) ?? INITIAL_MASTERY, event));
  }
  return next;
}

/** Rebuilds progress from scratch; the result does not depend on input order. */
export function rebuildProgress(events: readonly ProgressEvent[]): ProgressMap {
  return applyProgressEvents(
    new Map(),
    [...events].sort(compareProgressEvents),
  );
}

export function sessionProgressEvents(
  session: QuizSession,
  sessionId: string,
): ProgressEvent[] {
  return session.answers.map((answer, sequence) => ({
    category: session.config.category,
    countryCode: answer.countryCode,
    difficulty: session.config.difficulty,
    correct: answer.correct,
    answeredAt: answer.answeredAt,
    sessionId,
    sequence,
  }));
}

export interface ScopeProgress {
  readonly scope: QuizScope;
  readonly mastered: number;
  readonly total: number;
}

/** Mastered countries out of all countries in a scope (counts come from the dataset). */
export function scopeProgress(
  dataset: CountryDataset,
  progress: ProgressMap,
  category: QuizCategory,
  scope: QuizScope,
): ScopeProgress {
  const countries = countriesInScope(dataset, scope);
  const mastered = countries.filter((country) =>
    isMastered(masteryOf(progress, category, country.code)),
  ).length;
  return { scope, mastered, total: countries.length };
}

/** Progress for World and every region, in `QUIZ_SCOPES` order. */
export function progressByScope(
  dataset: CountryDataset,
  progress: ProgressMap,
  category: QuizCategory,
): ScopeProgress[] {
  return QUIZ_SCOPES.map((scope) =>
    scopeProgress(dataset, progress, category, scope),
  );
}

/**
 * Countries to offer in Practice Mistakes, most recently missed first
 * (ties in dataset order).
 */
export function practiceCandidates(
  dataset: CountryDataset,
  progress: ProgressMap,
  category: QuizCategory,
): CountryCode[] {
  return dataset
    .map((country, position) => ({
      code: country.code,
      position,
      state: masteryOf(progress, category, country.code),
    }))
    .filter(({ state }) => isMistake(state))
    .sort(
      (a, b) =>
        (b.state.lastAnsweredAt ?? 0) - (a.state.lastAnsweredAt ?? 0) ||
        a.position - b.position,
    )
    .map(({ code }) => code);
}
