import { HttpClient, httpResource } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  NavController,
  type SegmentCustomEvent,
  type ViewWillEnter,
} from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AUTH_CONFIG } from '@world-quiz/client/auth';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore, SyncService } from '@world-quiz/client/progress';
import { formatRunTime } from '@world-quiz/client/quiz-feature';
import { EmptyState } from '@world-quiz/client/ui';
import {
  challengeSchema,
  leaderboardSchema,
  myRecordsSchema,
} from '@world-quiz/shared/contracts';
import {
  isLeaderboardBoardId,
  LEADERBOARD_BOARDS,
  type LeaderboardBoardId,
} from '@world-quiz/quiz/domain';
import { firstValueFrom } from 'rxjs';

const LEADERBOARD_VIEWS = ['global', 'mine'] as const;
type LeaderboardView = (typeof LEADERBOARD_VIEWS)[number];

function isLeaderboardView(value: unknown): value is LeaderboardView {
  return (LEADERBOARD_VIEWS as readonly unknown[]).includes(value);
}

/**
 * Global ranking and personal records for the four perfect-run boards, and
 * where a challenge starts (docs/domain/leaderboard.md).
 *
 * Starting asks the API for a challenge — its id and the seed the quiz must
 * use — and opens the board's quiz with them. Boards and records come from
 * the API and are loaded again whenever the tab is shown and after every
 * sync: a finished run reaches the API through the sync, and Ionic may show
 * this page again from its cache without `ionViewWillEnter` (for example
 * after `navigateRoot('/leaderboard')` from a challenge's results).
 */
@Component({
  selector: 'wq-leaderboard-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    TranslocoPipe,
    PluralPipe,
    EmptyState,
  ],
  templateUrl: './leaderboard.page.html',
  styleUrl: './leaderboard.page.scss',
})
export class LeaderboardPage implements ViewWillEnter {
  private readonly http = inject(HttpClient);
  private readonly nav = inject(NavController);
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;
  protected readonly progress = inject(ProgressStore);
  private readonly sync = inject(SyncService);

  protected readonly boards = LEADERBOARD_BOARDS;
  protected readonly view = signal<LeaderboardView>('global');
  protected readonly board = signal<LeaderboardBoardId>('capitals-easy');
  protected readonly starting = signal(false);
  protected readonly startFailed = signal(false);
  protected readonly formatRunTime = formatRunTime;

  /** The board's ranking; public, the same for everyone. */
  protected readonly ranking = httpResource(
    () => `${this.apiUrl}/v1/leaderboards/${this.board()}`,
    { parse: (body) => leaderboardSchema.parse(body) },
  );

  /** The player's best ranked run per board. */
  protected readonly records = httpResource(
    () => `${this.apiUrl}/v1/me/records`,
    { parse: (body) => myRecordsSchema.parse(body) },
  );

  /** Every board with the player's record on it, if any. */
  protected readonly myRecords = computed(() => {
    const records = this.records.hasValue() ? this.records.value().records : [];
    return this.boards.map((board) => ({
      board: board.id,
      record: records.find((record) => record.board === board.id) ?? null,
    }));
  });

  /** The player's rank on the board shown, to highlight their row. */
  protected readonly myRank = computed(
    () =>
      this.myRecords().find((entry) => entry.board === this.board())?.record
        ?.rank ?? null,
  );

  constructor() {
    let lastSeen = this.sync.lastSyncedAt();
    effect(() => {
      const synced = this.sync.lastSyncedAt();
      if (synced === lastSeen) return;
      lastSeen = synced;
      untracked(() => this.reload());
    });
  }

  ionViewWillEnter(): void {
    this.reload();
  }

  private reload(): void {
    this.ranking.reload();
    this.records.reload();
  }

  // `ionChange` is a DOM event for Angular's strict templates, so the Ionic
  // event type is applied here and the value is validated before use.
  protected onViewChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isLeaderboardView(value)) {
      this.view.set(value);
    }
  }

  protected onBoardChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isLeaderboardBoardId(value)) {
      this.board.set(value);
    }
  }

  /** Asks the API for a challenge on the board shown, and plays it. */
  protected async startChallenge(): Promise<void> {
    const board = this.boards.find((entry) => entry.id === this.board());
    if (!board || this.starting()) return;
    this.starting.set(true);
    this.startFailed.set(false);
    try {
      const challenge = challengeSchema.parse(
        await firstValueFrom(
          this.http.post(`${this.apiUrl}/v1/challenges`, { board: board.id }),
        ),
      );
      await this.nav.navigateForward(`/quiz/${board.category}`, {
        queryParams: {
          mode: 'challenge',
          difficulty: board.difficulty,
          scope: 'world',
          challenge: challenge.id,
          seed: challenge.seed,
        },
      });
    } catch {
      this.startFailed.set(true);
    } finally {
      this.starting.set(false);
    }
  }
}
