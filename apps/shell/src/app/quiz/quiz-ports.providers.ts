import { inject, Injectable, type Provider } from '@angular/core';
import {
  QUIZ_PROGRESS_READER,
  QUIZ_RESULT_SINK,
  type QuizProgressReader,
  type QuizResultSink,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import {
  newlyUnlockedAchievements,
  practiceCandidates,
  type QuizCategory,
  type QuizScope,
  type QuizSession,
  type SessionSummary,
} from '@world-quiz/quiz/domain';
import { ProgressStore, SyncService } from '@world-quiz/client/progress';

/**
 * The shell's side of the microfrontend contract: it records finished
 * sessions — on the device and in the outbox — and reports what changed.
 * Remotes never touch the progress store, persistence or sync directly.
 */
@Injectable({ providedIn: 'root' })
export class ShellQuizResultSink implements QuizResultSink {
  private readonly progress = inject(ProgressStore);
  private readonly sync = inject(SyncService);

  submit(session: QuizSession, summary: SessionSummary): QuizSessionOutcome {
    const before = this.progress.achievements();
    this.progress.recordSession(session);
    const after = this.progress.achievements();
    // Sent now when online; otherwise it waits in the outbox.
    void this.sync.sync();

    return {
      newlyUnlocked: newlyUnlockedAchievements(before, after),
      mistakes: this.mistakesFor(session.config.category),
    };
  }

  /** Summaries are recomputed by the domain; the argument keeps the port explicit. */
  private mistakesFor(category: QuizCategory) {
    return practiceCandidates(
      this.progress.dataset,
      this.progress.snapshot(),
      category,
    );
  }
}

@Injectable({ providedIn: 'root' })
export class ShellQuizProgressReader implements QuizProgressReader {
  private readonly progress = inject(ProgressStore);

  mistakes(category: QuizCategory) {
    return practiceCandidates(
      this.progress.dataset,
      this.progress.snapshot(),
      category,
    );
  }

  scopeProgress(category: QuizCategory, scope: QuizScope) {
    return this.progress.scope(category, scope);
  }
}

/** Provided on the federated quiz routes, so remotes can resolve the ports. */
export function provideQuizPorts(): Provider[] {
  return [
    { provide: QUIZ_RESULT_SINK, useExisting: ShellQuizResultSink },
    { provide: QUIZ_PROGRESS_READER, useExisting: ShellQuizProgressReader },
  ];
}
