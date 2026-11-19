import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AUTH_CONFIG } from '@world-quiz/client/auth';
import { SettingsStore } from '@world-quiz/client/settings';
import {
  Dialog,
  EmptyState,
  PageChromeState,
  PageHeader,
  ProgressBar,
  Toasts,
} from '@world-quiz/client/ui';
import {
  type FriendAchievement,
  friendProfileSchema,
  type MyRecord,
} from '@world-quiz/shared/contracts';
import {
  ACHIEVEMENTS,
  formatRunTime,
  type LeaderboardBoardId,
  leaderboardBoardById,
  type LeaderboardMetric,
} from '@world-quiz/quiz/domain';
import { friendInitial, friendSince } from './friend-rows';
import { FriendsStore } from './friends.store';

/** One of the friend's records, with everything already in words. */
interface RecordRow {
  readonly board: LeaderboardBoardId;
  readonly subject: string;
  readonly style: string;
  readonly rank: number;
  readonly score: string;
  /** `null` where the rank is past the three that get a medal. */
  readonly medal: 'gold' | 'silver' | 'bronze' | null;
}

/** One of the friend's achievements, named the way the player's own are. */
interface AchievementRow {
  readonly id: string;
  readonly name: string;
  readonly mastered: number;
  readonly total: number;
  readonly unlocked: boolean;
}

const MEDALS = ['gold', 'silver', 'bronze'] as const;

/**
 * A friend's page: who they are, their best run on every board, and what
 * they have learned (ADR-015).
 *
 * It is exactly what the public boards already say about them, plus the
 * achievements — never their history of play, their mistakes or anything
 * about their account. Only a friend may open it: to everybody else the API
 * answers that there is no such player, and this page says the same.
 */
@Component({
  selector: 'wq-friend-page',
  imports: [
    Dialog,
    EmptyState,
    IonButton,
    IonContent,
    IonIcon,
    PageHeader,
    ProgressBar,
    TranslocoPipe,
  ],
  providers: [PageChromeState],
  templateUrl: './friend.page.html',
  styleUrl: './friend.page.scss',
})
export class FriendPage {
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;
  private readonly nav = inject(NavController);
  private readonly settings = inject(SettingsStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toasts = inject(Toasts);
  private readonly friends = inject(FriendsStore);

  /** The friend's id, bound from the route (`withComponentInputBinding`). */
  readonly id = input.required<string>();

  protected readonly confirming = signal(false);

  protected readonly profile = httpResource(
    () => `${this.apiUrl}/v1/friends/${this.id()}`,
    { parse: (body) => friendProfileSchema.parse(body) },
  );

  protected readonly friend = computed(() =>
    this.profile.hasValue() ? this.profile.value().friend : null,
  );

  /** The name in the header: their nickname once it is known. */
  protected readonly heading = computed(
    () =>
      this.friend()?.nickname ?? this.transloco.translate('friends.one.title'),
  );

  protected readonly initial = computed(() => {
    const friend = this.friend();
    return friend ? friendInitial(friend.nickname) : '';
  });

  protected readonly since = computed(() => {
    const friend = this.friend();
    return friend ? friendSince(friend.since, this.settings.locale()) : '';
  });

  /** The page could not be read: no longer a friend, offline, or an error. */
  protected readonly failed = computed(
    () => this.profile.error() !== undefined,
  );

  protected readonly records = computed<readonly RecordRow[]>(() =>
    (this.profile.hasValue() ? this.profile.value().records : []).map(
      (record) => this.recordRow(record),
    ),
  );

  protected readonly achievements = computed<readonly AchievementRow[]>(() =>
    (this.profile.hasValue() ? this.profile.value().achievements : [])
      .map((achievement) => this.achievementRow(achievement))
      .filter((row): row is AchievementRow => row !== null)
      // What they have got furthest with first: a page of zeros says
      // nothing, and 14 rows is more than anyone reads top to bottom.
      .sort((a, b) => b.mastered / b.total - a.mastered / a.total),
  );

  protected async remove(): Promise<void> {
    const friend = this.friend();
    if (!friend) return;
    this.confirming.set(false);
    const done = await this.friends.remove(friend.id);
    this.toasts[done ? 'success' : 'failure'](
      this.transloco.translate(
        done ? 'friends.remove.done' : 'friends.failed',
        { name: friend.nickname },
      ),
    );
    if (done) await this.nav.navigateBack('/friends');
  }

  private recordRow(record: MyRecord): RecordRow {
    const board = leaderboardBoardById(record.board);
    return {
      board: record.board,
      subject: this.transloco.translate('leaderboard.boardSubject', {
        category: this.transloco.translate(`categories.${board.category}`),
        region: this.transloco.translate(`regions.${board.scope}`),
      }),
      style: this.transloco.translate('leaderboard.boardStyle', {
        difficulty: this.transloco.translate(`difficulty.${board.difficulty}`),
        mode: this.transloco.translate(`modes.${board.mode}`),
      }),
      rank: record.rank,
      score: this.scoreText(record.score, board.metric),
      medal: MEDALS[record.rank - 1] ?? null,
    };
  }

  private achievementRow(
    achievement: FriendAchievement,
  ): AchievementRow | null {
    const definition = ACHIEVEMENTS.find(
      (candidate) => candidate.id === achievement.id,
    );
    if (!definition || achievement.total === 0) return null;
    return {
      id: achievement.id,
      name: this.transloco.translate(
        `achievements.name.${definition.category}`,
        { scope: this.transloco.translate(`regions.${definition.scope}`) },
      ),
      mastered: achievement.mastered,
      total: achievement.total,
      unlocked: achievement.status === 'unlocked',
    };
  }

  /** What a score means on a board: a time, or a number of answers. */
  private scoreText(score: number, metric: LeaderboardMetric): string {
    return metric === 'time'
      ? formatRunTime(score)
      : this.transloco.translate('leaderboard.correct', { correct: score });
  }
}
