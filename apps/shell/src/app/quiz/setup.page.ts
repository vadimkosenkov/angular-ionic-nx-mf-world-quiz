import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  type SegmentCustomEvent,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '@world-quiz/client/i18n';
import {
  FadesWithPage,
  PageChromeState,
  PageHeader,
  TourStep,
} from '@world-quiz/client/ui';
import { ProgressStore } from '@world-quiz/client/progress';
import { TipsStore } from '../core/tips.store';
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

/** The tour walks the screen's choices in the order they are shown. */
export const TOUR_STEPS = ['category', 'scope', 'difficulty', 'mode'] as const;
export type TourStepId = (typeof TOUR_STEPS)[number];

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
    IonContent,
    PageHeader,
    FadesWithPage,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonButton,
    TranslocoPipe,
    PluralPipe,
    TourStep,
  ],
  providers: [PageChromeState],
  templateUrl: './setup.page.html',
  styleUrl: './setup.page.scss',
})
export class QuizSetupPage {
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressStore);
  private readonly tips = inject(TipsStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * The guided tour of this screen: one step per choice, in the order the
   * screen presents them. A player can otherwise arrive here with
   * everything already chosen and press Start without noticing that any of
   * it is theirs to pick.
   *
   * Whether it runs is the store's state, not a copy of it, so bringing the
   * hints back in Settings simply makes it run again.
   */
  protected readonly tourSteps = TOUR_STEPS;
  protected readonly tourIndex = signal(0);
  protected readonly tourRunning = computed(() => this.tips.shows('setup'));
  protected readonly tourStep = computed(() =>
    this.tourRunning() ? (TOUR_STEPS[this.tourIndex()] ?? null) : null,
  );
  protected readonly lastTourStep = computed(
    () => this.tourIndex() === TOUR_STEPS.length - 1,
  );
  protected readonly tourStepParams = computed(() => ({
    current: this.tourIndex() + 1,
    total: TOUR_STEPS.length,
  }));

  /** Everything the step is not about waits, blurred and out of reach. */
  protected dimmed(section: TourStepId): boolean {
    const step = this.tourStep();
    return step !== null && step !== section;
  }

  protected readonly categories = QUIZ_CATEGORIES;
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

  /**
   * The regions to choose from, each with the number of countries it holds,
   * so the size of a round is clear before it starts. Counted once: the
   * dataset is fixed for the life of the app.
   */
  protected readonly scopeOptions = QUIZ_SCOPES.map((scope) => ({
    scope,
    count: countriesInScope(this.progress.dataset, scope).length,
  }));

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

  /** Moves to the next step, or ends the tour after the last one. */
  protected advanceTour(): void {
    if (this.lastTourStep()) {
      this.endTour();
      return;
    }
    this.tourIndex.update((index) => index + 1);
    this.showTourStep();
  }

  /**
   * Ends the tour for good: the player has been through it, or left it with
   * Escape. The index goes back to the start, so bringing the hints back in
   * Settings begins at the first step.
   */
  protected endTour(): void {
    this.tips.dismiss('setup');
    this.tourIndex.set(0);
  }

  /** Brings the step's own section into view, under the tour's card. */
  private showTourStep(): void {
    const step = this.tourStep();
    if (!step) return;
    this.host.nativeElement
      .querySelector(`[data-tour="${step}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

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
