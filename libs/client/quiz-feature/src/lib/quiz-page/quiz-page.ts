import { Component, computed, inject, input, signal } from '@angular/core';
import { IonContent, NavController, type ViewWillEnter } from '@ionic/angular';
import {
  COUNTRY_DATASET,
  QUIZ_RESULT_SINK,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import {
  createQuizEngine,
  DEFAULT_FIXED_QUESTION_COUNT,
  isDifficulty,
  isQuizScope,
  isTrainingMode,
  type QuizCategory,
  type QuizConfig,
  type QuizSession,
  type SessionSummary,
} from '@world-quiz/quiz/domain';

import { QuizPlay } from '../quiz-play/quiz-play';
import { QuizResults } from '../quiz-results/quiz-results';

interface FinishedQuiz {
  readonly summary: SessionSummary;
  readonly outcome: QuizSessionOutcome;
}

/**
 * The screen every quiz microfrontend exposes: it turns the route into a
 * `QuizConfig`, plays the session and hands the finished session to the host
 * through `QUIZ_RESULT_SINK`.
 *
 * The category comes from the route's `data` (each remote mounts this page
 * with its own, see `quizRemoteRoutes`); the options come from the query
 * string. Both are bound as inputs by `withComponentInputBinding()`, so a quiz
 * is deep-linkable and reloading replays the same configuration. The remote
 * owns the quiz; it does not know how progress is stored.
 */
@Component({
  selector: 'wq-quiz-page',
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
export class QuizPage implements ViewWillEnter {
  private readonly nav = inject(NavController);
  private readonly results = inject(QUIZ_RESULT_SINK);
  private readonly engine = createQuizEngine(inject(COUNTRY_DATASET));

  /**
   * Bound from the query string by `withComponentInputBinding()`; query
   * parameters are always strings, and anything unknown falls back to the
   * default instead of failing the navigation.
   */
  /** Set by the remote's routes (`quizRemoteRoutes`), never by the user. */
  readonly category = input.required<QuizCategory>();
  readonly scope = input('world');
  readonly difficulty = input('easy');
  readonly mode = input('fixed');
  readonly count = input<string | undefined>(undefined);

  protected readonly config = computed<QuizConfig>(() => {
    const category = this.category();
    const scope = this.scope();
    const difficulty = this.difficulty();
    const mode = this.mode();
    const requested = Number(this.count() ?? DEFAULT_FIXED_QUESTION_COUNT);
    const resolvedMode = isTrainingMode(mode) ? mode : 'fixed';

    return {
      category,
      scope: isQuizScope(scope) ? scope : 'world',
      difficulty: isDifficulty(difficulty) ? difficulty : 'easy',
      mode: resolvedMode,
      ...(resolvedMode === 'fixed'
        ? {
            // Same rule as the domain: a positive whole number, otherwise
            // the default (a hand-edited `?count=0` must not break the quiz).
            questionCount:
              Number.isInteger(requested) && requested >= 1
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

  private hasEntered = false;

  /**
   * Ionic caches pages in its navigation stack and can show an existing one
   * again when the same URL is opened. A quiz page shown again must start a
   * new quiz, never replay the results of the previous one.
   */
  ionViewWillEnter(): void {
    if (this.hasEntered) this.playAgain();
    this.hasEntered = true;
  }

  protected playAgain(): void {
    this.finished.set(null);
    this.seed.set(crypto.randomUUID());
  }

  /**
   * Leaving ends the quiz: `navigateRoot` replaces the whole navigation stack,
   * so neither this page nor the setup page stays behind hidden. A plain
   * forward navigation to /home could leave them in the stack.
   */
  protected exit(): void {
    void this.nav.navigateRoot('/home', { animationDirection: 'back' });
  }
}
