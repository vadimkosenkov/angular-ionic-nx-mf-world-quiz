import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import {
  IonButton,
  IonContent,
  NavController,
  type ViewDidLeave,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  COUNTRY_DATASET,
  QUIZ_PROGRESS_READER,
  QUIZ_RESULT_SINK,
  type QuizSessionOutcome,
} from '@world-quiz/client/quiz-ports';
import {
  CHALLENGE_MODE,
  countriesInScope,
  type CountryCode,
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
import {
  type ChallengeResult,
  QuizResults,
} from '../quiz-results/quiz-results';

/** The query value that starts Practice Mistakes. */
export const PRACTICE_MODE = 'practice';
/** Countries in one Practice Mistakes round, most recently missed first. */
export const PRACTICE_ROUND_SIZE = 20;

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
 *
 * A leaderboard challenge comes as `mode=challenge` with the `challenge` id
 * and the `seed` the server issued for it: the whole World set, played with
 * exactly that seed, and handed to the host with the challenge id. Without
 * both, `mode=challenge` falls back to a training quiz.
 *
 * Practice Mistakes is `mode=practice`: a Quick round over the countries the
 * player still has to review in this category (and scope), read from the
 * host through `QUIZ_PROGRESS_READER` when the round starts — the list does
 * not change while the round is played.
 */
@Component({
  selector: 'wq-quiz-page',
  imports: [IonButton, IonContent, QuizPlay, QuizResults, TranslocoPipe],
  template: `
    <ion-content [fullscreen]="true" class="wq-aurora">
      <div class="wq-page quiz-page">
        @if (practiceIsEmpty()) {
          <div class="wq-card nothing" data-testid="practice-empty">
            <h1>{{ 'practice.emptyTitle' | transloco }}</h1>
            <p>{{ 'practice.empty' | transloco }}</p>
            <ion-button
              class="wq-glass-button secondary"
              expand="block"
              (click)="exit()"
            >
              {{ 'results.backHome' | transloco }}
            </ion-button>
          </div>
        } @else if (finished(); as result) {
          <wq-quiz-results
            [config]="config()"
            [summary]="result.summary"
            [outcome]="result.outcome"
            [challenge]="challengeResult()"
            (playAgain)="playAgain()"
            (exited)="exit()"
          />
        } @else {
          <wq-quiz-play
            [config]="config()"
            [seed]="playSeed()"
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
    .nothing {
      display: flex;
      flex-direction: column;
      gap: var(--wq-space-3);
      padding: var(--wq-space-6) var(--wq-space-5);
      text-align: center;
    }
    .nothing h1 {
      margin: 0;
      font-size: 1.375rem;
    }
    .nothing p {
      margin: 0;
    }
  `,
})
export class QuizPage implements ViewDidLeave {
  private readonly nav = inject(NavController);
  private readonly results = inject(QUIZ_RESULT_SINK);
  private readonly progress = inject(QUIZ_PROGRESS_READER);
  private readonly dataset = inject(COUNTRY_DATASET);
  private readonly engine = createQuizEngine(this.dataset);

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
  /** Leaderboard challenges: the server's challenge id and seed. */
  readonly challenge = input<string | undefined>(undefined);
  readonly seed = input<string | undefined>(undefined);

  /** The challenge this page plays, if the URL describes a complete one. */
  private readonly challengeRun = computed(() => {
    const id = this.challenge();
    const seed = this.seed();
    return this.mode() === CHALLENGE_MODE && id && seed ? { id, seed } : null;
  });

  /**
   * Practice Mistakes: the countries to review, taken when the round starts
   * (and again for "Play again"), not live — recording this round changes
   * them, and the running quiz must keep its questions.
   */
  private readonly practiceCodes = linkedSignal<readonly CountryCode[] | null>(
    () => {
      if (this.mode() !== PRACTICE_MODE) return null;
      const category = this.category();
      const scope = this.scope();
      return untracked(() => this.mistakesToPractice(category, scope));
    },
  );
  protected readonly practiceIsEmpty = computed(
    () => this.practiceCodes()?.length === 0,
  );

  protected readonly config = computed<QuizConfig>(() => {
    const category = this.category();
    const practice = this.practiceCodes();
    if (practice && practice.length > 0) {
      const scope = this.scope();
      const difficulty = this.difficulty();
      return {
        category,
        scope: isQuizScope(scope) ? scope : 'world',
        difficulty: isDifficulty(difficulty) ? difficulty : 'easy',
        mode: 'fixed',
        questionCount: practice.length,
        countryCodes: practice,
      };
    }
    if (this.challengeRun()) {
      const difficulty = this.difficulty();
      return {
        category,
        difficulty: isDifficulty(difficulty) ? difficulty : 'easy',
        mode: CHALLENGE_MODE,
        scope: 'world',
      };
    }
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

  /** A new seed per training session: random questions, but reproducible. */
  private readonly trainingSeed = signal(crypto.randomUUID());
  protected readonly playSeed = computed(
    () => this.challengeRun()?.seed ?? this.trainingSeed(),
  );
  protected readonly finished = signal<FinishedQuiz | null>(null);
  /** The server's verdict on a challenge run, as it arrives. */
  protected readonly challengeResult = signal<ChallengeResult | null>(null);

  protected onFinished(session: QuizSession): void {
    const summary = this.engine.summarize(session);
    const challenge = this.challengeRun();
    const outcome = this.results.submit(
      session,
      summary,
      challenge ? { challengeId: challenge.id } : undefined,
    );
    this.finished.set({ summary, outcome });

    if (outcome.challenge) {
      this.challengeResult.set({ status: 'checking' });
      outcome.challenge
        .then((verdict) =>
          this.challengeResult.set(
            verdict
              ? { status: 'done', outcome: verdict }
              : { status: 'unsent' },
          ),
        )
        .catch(() => this.challengeResult.set({ status: 'unsent' }));
    }
  }

  /**
   * Ionic caches pages in its navigation stack and can show an existing one
   * again when the same URL is opened. Once the player has left, the page is
   * reset, so if Ionic brings it back it starts a new quiz instead of showing
   * the previous results.
   *
   * `ionViewDidLeave` fires only when leaving has completed. Resetting on
   * `ionViewWillEnter` instead would also restart a quiz in progress when an
   * iOS swipe-back gesture is started and then cancelled.
   */
  ionViewDidLeave(): void {
    this.reset();
  }

  /**
   * A training quiz starts again with new questions. A challenge is played
   * once: "again" means a new challenge, which the leaderboard starts.
   */
  protected playAgain(): void {
    if (this.challengeRun()) {
      void this.nav.navigateRoot('/leaderboard', {
        animationDirection: 'back',
      });
      return;
    }
    this.reset();
  }

  private reset(): void {
    this.finished.set(null);
    this.challengeResult.set(null);
    this.trainingSeed.set(crypto.randomUUID());
    if (this.mode() === PRACTICE_MODE) {
      this.practiceCodes.set(
        this.mistakesToPractice(this.category(), this.scope()),
      );
    }
  }

  /** Up to a round of the category's mistakes within the scope. */
  private mistakesToPractice(
    category: QuizCategory,
    scope: string,
  ): readonly CountryCode[] {
    const inScope = new Set(
      countriesInScope(this.dataset, isQuizScope(scope) ? scope : 'world').map(
        (country) => country.code,
      ),
    );
    return this.progress
      .mistakes(category)
      .filter((code) => inScope.has(code))
      .slice(0, PRACTICE_ROUND_SIZE);
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
