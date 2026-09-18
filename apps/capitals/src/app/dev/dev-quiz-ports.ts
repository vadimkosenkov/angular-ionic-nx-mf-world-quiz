import { inject, Injectable, type Provider, signal } from '@angular/core';
import {
  COUNTRY_DATASET,
  QUIZ_PROGRESS_READER,
  QUIZ_RESULT_SINK,
  type QuizProgressReader,
  type QuizResultSink,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import {
  applyProgressEvents,
  evaluateAchievements,
  newlyUnlockedAchievements,
  practiceCandidates,
  type ProgressMap,
  type QuizCategory,
  type QuizScope,
  type QuizSession,
  scopeProgress,
  sessionProgressEvents,
} from '@world-quiz/quiz/domain';

/**
 * In-memory stand-in for the shell's ports, used only when this remote is
 * served on its own (`nx serve capitals`) so the quiz can be developed
 * without starting the shell. Progress is lost on reload — the real
 * implementation lives in the shell (apps/shell/src/app/quiz).
 */
@Injectable({ providedIn: 'root' })
export class DevQuizPorts implements QuizResultSink, QuizProgressReader {
  private readonly dataset = inject(COUNTRY_DATASET);
  private readonly progress = signal<ProgressMap>(new Map());

  submit(session: QuizSession): QuizSessionOutcome {
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
    };
  }

  mistakes(category: QuizCategory) {
    return practiceCandidates(this.dataset, this.progress(), category);
  }

  scopeProgress(category: QuizCategory, scope: QuizScope) {
    return scopeProgress(this.dataset, this.progress(), category, scope);
  }
}

export function provideDevQuizPorts(): Provider[] {
  return [
    { provide: QUIZ_RESULT_SINK, useExisting: DevQuizPorts },
    { provide: QUIZ_PROGRESS_READER, useExisting: DevQuizPorts },
  ];
}
