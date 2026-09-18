import { Component, computed, inject, signal } from '@angular/core';
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
import {
  DEFAULT_FIXED_QUESTION_COUNT,
  DIFFICULTIES,
  type Difficulty,
  isDifficulty,
  isQuizCategory,
  isQuizScope,
  isTrainingMode,
  QUIZ_CATEGORIES,
  QUIZ_SCOPES,
  type QuizCategory,
  type QuizScope,
  TRAINING_MODES,
  type TrainingMode,
} from '@world-quiz/quiz/domain';

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

  protected readonly categories = QUIZ_CATEGORIES;
  protected readonly scopes = QUIZ_SCOPES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly modes = TRAINING_MODES;
  protected readonly defaultQuestionCount = DEFAULT_FIXED_QUESTION_COUNT;

  protected readonly category = signal<QuizCategory>('capitals');
  protected readonly scope = signal<QuizScope>('world');
  protected readonly difficulty = signal<Difficulty>('easy');
  protected readonly mode = signal<TrainingMode>('fixed');

  protected readonly categoryIcons: Readonly<Record<QuizCategory, string>> = {
    capitals: 'business-outline',
    flags: 'flag-outline',
  };
  /**
   * Only categories with a microfrontend behind them can be started. Flags
   * follows in the next phase; until then the option is visible but disabled
   * rather than pretending to work.
   */
  protected readonly availableCategories: readonly QuizCategory[] = [
    'capitals',
  ];
  protected readonly hasUnavailableCategory = QUIZ_CATEGORIES.some(
    (category) => !this.availableCategories.includes(category),
  );
  protected readonly modeIcons: Readonly<Record<TrainingMode, string>> = {
    fixed: 'list-outline',
    endless: 'infinite-outline',
    timed: 'timer-outline',
  };

  protected readonly modeHintParams = computed(() => ({
    count: this.defaultQuestionCount,
  }));

  protected onCategoryChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isQuizCategory(value) && this.isAvailable(value))
      this.category.set(value);
  }

  protected onDifficultyChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isDifficulty(value)) this.difficulty.set(value);
  }

  protected selectScope(scope: string): void {
    if (isQuizScope(scope)) this.scope.set(scope);
  }

  protected selectMode(mode: string): void {
    if (isTrainingMode(mode)) this.mode.set(mode);
  }

  protected isAvailable(category: QuizCategory): boolean {
    return this.availableCategories.includes(category);
  }

  protected start(): void {
    void this.router.navigate(['/quiz', this.category()], {
      queryParams: {
        scope: this.scope(),
        difficulty: this.difficulty(),
        mode: this.mode(),
        ...(this.mode() === 'fixed'
          ? { count: this.defaultQuestionCount }
          : {}),
      },
    });
  }
}
