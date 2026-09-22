import { Component, computed, inject } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProgressBar } from '@world-quiz/client/ui';
import type { AchievementStatus } from '@world-quiz/quiz/domain';
import { ProgressStore } from '@world-quiz/client/progress';

/** Status is shown with an icon and a text label, never with colour alone. */
const STATUS_ICONS: Readonly<Record<AchievementStatus, string>> = {
  unlocked: 'checkmark-circle',
  'in-progress': 'time-outline',
  locked: 'lock-closed-outline',
};

@Component({
  selector: 'wq-achievements-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    TranslocoPipe,
    ProgressBar,
  ],
  templateUrl: './achievements.page.html',
  styleUrl: './achievements.page.scss',
})
export class AchievementsPage {
  protected readonly progress = inject(ProgressStore);
  protected readonly statusIcons = STATUS_ICONS;
  protected readonly statuses = Object.keys(
    STATUS_ICONS,
  ) as AchievementStatus[];

  protected readonly summary = computed(() => {
    const total = this.progress.achievements().length;
    const unlocked = this.progress.unlockedAchievements();
    return {
      total,
      unlocked,
      percent: total === 0 ? 0 : Math.round((unlocked / total) * 100),
    };
  });
}
