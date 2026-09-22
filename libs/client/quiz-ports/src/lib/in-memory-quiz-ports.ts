import { inject, Injectable, type Provider, signal } from '@angular/core';
import {
  COUNTRY_DATASET,
  QUIZ_PROGRESS_READER,
  QUIZ_RESULT_SINK,
  type QuizProgressReader,
  type QuizResultSink,
  type QuizSessionOutcome,
} from './quiz-ports';
import {
  applyProgressEvents,
  evaluateAchievements,
  newlyUnlockedAchievements,
  practiceCandidates,
  type ProgressMap,
  type QuizCategory,
  type QuizScope,
  scopeProgress,
  sessionProgressEvents,
} from '@world-quiz/quiz/domain';

/**
 * In-memory implementation of the quiz ports, for a remote served on its own
 * (`nx serve capitals`, `nx serve flags`) so the quiz can be developed without
 * the shell. Progress is lost on reload; the real implementation lives in the
 * shell (apps/shell/src/app/quiz). There is no server here, so a challenge
 * run gets no verdict (`challenge: null`).
 */
@Injectable({ providedIn: 'root' })
export class InMemoryQuizPorts implements QuizResultSink, QuizProgressReader {
  private readonly dataset = inject(COUNTRY_DATASET);
  private readonly progress = signal<ProgressMap>(new Map());

  submit(
    ...[session, , context]: Parameters<QuizResultSink['submit']>
  ): QuizSessionOutcome {
    const before = evaluateAchievements(this.dataset, this.progress());
    this.progress.update((current) =>
      applyProgressEvents(
        current,
        sessionProgressEvents(session, crypto.randomUUID()),
      ),
    );
    const after = evaluateAchievements(this.dataset, this.progress());

    return {
      newlyUnlocked: newlyUnlockedAchievements(before, after),
      mistakes: this.mistakes(session.config.category),
      ...(context?.challengeId ? { challenge: Promise.resolve(null) } : {}),
    };
  }

  mistakes(category: QuizCategory) {
    return practiceCandidates(this.dataset, this.progress(), category);
  }

  scopeProgress(category: QuizCategory, scope: QuizScope) {
    return scopeProgress(this.dataset, this.progress(), category, scope);
  }
}

export function provideInMemoryQuizPorts(): Provider[] {
  return [
    { provide: QUIZ_RESULT_SINK, useExisting: InMemoryQuizPorts },
    { provide: QUIZ_PROGRESS_READER, useExisting: InMemoryQuizPorts },
  ];
}
