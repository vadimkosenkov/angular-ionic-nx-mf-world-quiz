import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  type ViewWillEnter,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { PluralPipe } from '@world-quiz/client/i18n';
import {
  EmptyState,
  PageHeader,
  ProgressBar,
  ProgressCard,
} from '@world-quiz/client/ui';
import { practiceCandidates, QUIZ_CATEGORIES } from '@world-quiz/quiz/domain';
import { greetingFor } from '../core/greeting';
import { LastSetupStore } from '../core/last-setup.store';
import { ProgressStore } from '@world-quiz/client/progress';
import { CLOCK } from '../core/tokens';

@Component({
  selector: 'wq-home-page',
  imports: [
    IonButton,
    IonContent,
    PageHeader,
    IonIcon,
    RouterLink,
    TranslocoPipe,
    PluralPipe,
    ProgressBar,
    ProgressCard,
    EmptyState,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements ViewWillEnter {
  protected readonly progress = inject(ProgressStore);
  /** What the Play card says pressing it is going to start. */
  protected readonly lastSetup = inject(LastSetupStore);
  private readonly clock = inject(CLOCK);

  /**
   * Ionic keeps tab pages alive, so the greeting is refreshed every time the
   * tab is entered instead of being computed once.
   */
  protected readonly greeting = signal(this.currentGreeting());

  ionViewWillEnter(): void {
    this.greeting.set(this.currentGreeting());
  }

  private currentGreeting() {
    return greetingFor(new Date(this.clock.now()).getHours());
  }

  /** Categories with countries to review, for the "Practise" buttons. */
  protected readonly practice = computed(() =>
    QUIZ_CATEGORIES.map((category) => ({
      category,
      count: practiceCandidates(
        this.progress.dataset,
        this.progress.snapshot(),
        category,
      ).length,
    })).filter((entry) => entry.count > 0),
  );

  /** Most advanced achievements first, so the preview shows what is closest. */
  protected readonly achievementPreview = computed(() =>
    [...this.progress.achievements()]
      .sort((a, b) => b.mastered / (b.total || 1) - a.mastered / (a.total || 1))
      .slice(0, 3),
  );
}
