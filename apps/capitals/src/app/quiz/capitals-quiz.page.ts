import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import {
  QUIZ_RESULT_SINK,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import { QuizPlay, QuizResults } from '@world-quiz/client/quiz-feature';
import {
  createQuizEngine,
  DEFAULT_FIXED_QUESTION_COUNT,
  isDifficulty,
  isQuizScope,
  isTrainingMode,
  type QuizConfig,
  type QuizSession,
  type SessionSummary,
} from '@world-quiz/quiz/domain';
import { COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';

interface FinishedQuiz {
  readonly summary: SessionSummary;
  readonly outcome: QuizSessionOutcome;
}

/**
 * The Capitals microfrontend's only screen: it turns the route's query
 * parameters into a `QuizConfig`, plays the session and hands the finished
 * session to the shell through `QUIZ_RESULT_SINK`.
 *
 * The remote owns the quiz; it does not know how progress is stored. Route
 * inputs are bound from the query string (`withComponentInputBinding`), so a
 * quiz is deep-linkable and reloading replays the same configuration.
 */
@Component({
  selector: 'wq-capitals-quiz-page',
  imports: [IonContent, QuizPlay, QuizResults],
  template: `
    <ion-content [fullscreen]="true" class="wq-aurora">
      <div class="wq-page quiz-page">
        @if (finished(); as result) {
          <wq-quiz-results
            [config]="config()"
            [summary]="result.summary"
            [outcome]="result.outcome"
            (playAgain)="playAgain()"
            (exited)="exit()"
          />
        } @else {
          <wq-quiz-play
            [config]="config()"
            [seed]="seed()"
            (finished)="onFinished($event)"
            (exited)="exit()"
          />
        }
      </div>
    </ion-content>
  `,
  styles: `
    /* The quiz has no ion-header to reserve the status bar area, so the page
       keeps clear of the notch itself. */
    .quiz-page {
      display: flex;
      flex-direction: column;
      gap: var(--wq-space-5);
      padding-top: calc(var(--wq-space-4) + var(--ion-safe-area-top, 0px));
    }
  `,
})
export class CapitalsQuizPage {
  private readonly router = inject(Router);
  private readonly results = inject(QUIZ_RESULT_SINK);
  private readonly engine = createQuizEngine(inject(COUNTRY_DATASET));

  /**
   * Bound from the query string by `withComponentInputBinding()`; query
   * parameters are always strings, and anything unknown falls back to the
   * default instead of failing the navigation.
   */
  readonly scope = input('world');
  readonly difficulty = input('easy');
  readonly mode = input('fixed');
  readonly count = input<string | undefined>(undefined);

  protected readonly config = computed<QuizConfig>(() => {
    const scope = this.scope();
    const difficulty = this.difficulty();
    const mode = this.mode();
    const requested = Number(this.count() ?? DEFAULT_FIXED_QUESTION_COUNT);
    const resolvedMode = isTrainingMode(mode) ? mode : 'fixed';

    return {
      category: 'capitals',
      scope: isQuizScope(scope) ? scope : 'world',
      difficulty: isDifficulty(difficulty) ? difficulty : 'easy',
      mode: resolvedMode,
      ...(resolvedMode === 'fixed'
        ? {
            questionCount: Number.isInteger(requested)
              ? requested
              : DEFAULT_FIXED_QUESTION_COUNT,
          }
        : {}),
    };
  });

  /** A new seed per session: the questions are random, but reproducible. */
  protected readonly seed = signal(crypto.randomUUID());
  protected readonly finished = signal<FinishedQuiz | null>(null);

  protected onFinished(session: QuizSession): void {
    const summary = this.engine.summarize(session);
    this.finished.set({
      summary,
      outcome: this.results.submit(session, summary),
    });
  }

  protected playAgain(): void {
    this.finished.set(null);
    this.seed.set(crypto.randomUUID());
  }

  protected exit(): void {
    void this.router.navigate(['/home']);
  }
}
