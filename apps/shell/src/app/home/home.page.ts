import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
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
    IonBadge,
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
export class HomePage {
  protected readonly progress = inject(ProgressStore);
  private readonly clock = inject(CLOCK);

  protected readonly greeting = greetingFor(
    new Date(this.clock.now()).getHours(),
  );

  protected readonly categories: readonly CategoryCard[] = [
    { category: 'capitals', icon: 'business', featured: true },
    { category: 'flags', icon: 'flag', featured: false },
  ];

  /** Most advanced achievements first, so the preview shows what is closest. */
  protected readonly achievementPreview = computed(() =>
    [...this.progress.achievements()]
      .sort((a, b) => b.mastered / (b.total || 1) - a.mastered / (a.total || 1))
      .slice(0, 3),
  );
}
