import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  type SegmentCustomEvent,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProgressStore } from '@world-quiz/client/progress';
import {
  countriesInScope,
  DEFAULT_FIXED_QUESTION_COUNT,
  DIFFICULTIES,
  type Difficulty,
  isDifficulty,
  isQuizCategory,
  isQuizScope,
  practiceCandidates,
  QUIZ_CATEGORIES,
  QUIZ_SCOPES,
  type QuizCategory,
  type QuizScope,
  TRAINING_MODES,
} from '@world-quiz/quiz/domain';

/** Training modes, and Practice Mistakes (a Quick round over the mistakes). */
const SETUP_MODES = [...TRAINING_MODES, 'practice'] as const;
type SetupMode = (typeof SETUP_MODES)[number];
const isSetupMode = (value: unknown): value is SetupMode =>
  (SETUP_MODES as readonly unknown[]).includes(value);

/**
 * Quiz setup lives in the shell: it is category-agnostic and decides which
 * microfrontend to open. The chosen options travel as query parameters, so a
 * quiz is deep-linkable and the remote can validate them itself.
 */
@Component({
  selector: 'wq-quiz-setup-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonButton,
    TranslocoPipe,
  ],
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
})
export class QuizSetupPage {
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);

  protected readonly categories = QUIZ_CATEGORIES;
  protected readonly scopes = QUIZ_SCOPES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly modes = SETUP_MODES;
  protected readonly defaultQuestionCount = DEFAULT_FIXED_QUESTION_COUNT;

  /**
   * `?category=` from the link that opened the setup (Home's category cards),
   * bound by `withComponentInputBinding()`. Unknown values fall back to
   * Capitals; the player can still switch.
   */
  readonly category = input<string>();
  /** `?mode=practice` from Home's "Practise" buttons. */
  readonly mode = input<string>();

  protected readonly selectedCategory = linkedSignal<QuizCategory>(() => {
    const requested = this.category();
    return isQuizCategory(requested) ? requested : 'capitals';
  });
  protected readonly scope = signal<QuizScope>('world');
  protected readonly difficulty = signal<Difficulty>('easy');
  protected readonly selectedMode = linkedSignal<SetupMode>(() => {
    const requested = this.mode();
    return isSetupMode(requested) ? requested : 'fixed';
  });

  /** Countries to review in the chosen category and region. */
  protected readonly mistakes = computed(() => {
    const inScope = new Set(
      countriesInScope(this.progress.dataset, this.scope()).map(
        (country) => country.code,
      ),
    );
    return practiceCandidates(
      this.progress.dataset,
      this.progress.snapshot(),
      this.selectedCategory(),
    ).filter((code) => inScope.has(code)).length;
  });

  protected readonly categoryIcons: Readonly<Record<QuizCategory, string>> = {
    capitals: 'business-outline',
    flags: 'flag-outline',
  };
  protected readonly modeIcons: Readonly<Record<SetupMode, string>> = {
    fixed: 'list-outline',
    endless: 'infinite-outline',
    timed: 'timer-outline',
    practice: 'refresh-outline',
  };

  protected readonly modeHintParams = computed(() => ({
    count: this.defaultQuestionCount,
    mistakes: this.mistakes(),
  }));

  /** Practice Mistakes needs something to practise. */
  protected readonly canStart = computed(
    () => this.selectedMode() !== 'practice' || this.mistakes() > 0,
  );

  protected onCategoryChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isQuizCategory(value)) this.selectedCategory.set(value);
  }

  protected onDifficultyChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isDifficulty(value)) this.difficulty.set(value);
  }

  protected selectScope(scope: string): void {
    if (isQuizScope(scope)) this.scope.set(scope);
  }

  protected selectMode(mode: string): void {
    if (isSetupMode(mode)) this.selectedMode.set(mode);
  }

  protected start(): void {
    if (!this.canStart()) return;
    void this.router.navigate(['/quiz', this.selectedCategory()], {
      queryParams: {
        scope: this.scope(),
        difficulty: this.difficulty(),
        mode: this.selectedMode(),
        ...(this.selectedMode() === 'fixed'
          ? { count: this.defaultQuestionCount }
          : {}),
      },
    });
  }
}
