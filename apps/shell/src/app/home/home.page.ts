import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  type ViewWillEnter,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '@world-quiz/client/i18n';
import { EmptyState, ProgressBar, ProgressCard } from '@world-quiz/client/ui';
import { type QuizCategory } from '@world-quiz/quiz/domain';
import { greetingFor } from '../core/greeting';
import { ProgressStore } from '../core/progress.store';
import { CLOCK } from '../core/tokens';

interface CategoryCard {
  readonly category: QuizCategory;
  readonly icon: string;
  readonly featured: boolean;
}

@Component({
  selector: 'wq-home-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonButton,
    RouterLink,
    TranslocoPipe,
    PluralPipe,
    ProgressCard,
    ProgressBar,
    EmptyState,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements ViewWillEnter {
  protected readonly progress = inject(ProgressStore);
  private readonly clock = inject(CLOCK);

  /**
   * Ionic keeps tab pages alive, so the greeting is refreshed every time the
   * tab is entered instead of being computed once.
   */
  protected readonly greeting = signal(this.currentGreeting());

  protected readonly categories: readonly CategoryCard[] = [
    { category: 'capitals', icon: 'business', featured: true },
    { category: 'flags', icon: 'flag', featured: false },
  ];

  ionViewWillEnter(): void {
    this.greeting.set(this.currentGreeting());
  }

  private currentGreeting() {
    return greetingFor(new Date(this.clock.now()).getHours());
  }

  /** Most advanced achievements first, so the preview shows what is closest. */
  protected readonly achievementPreview = computed(() =>
    [...this.progress.achievements()]
      .sort((a, b) => b.mastered / (b.total || 1) - a.mastered / (a.total || 1))
      .slice(0, 3),
  );
}
