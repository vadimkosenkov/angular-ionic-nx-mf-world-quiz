import { httpResource } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  type SegmentCustomEvent,
  type ViewWillEnter,
} from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AUTH_CONFIG } from '@world-quiz/client/auth';
import { PluralPipe } from '@world-quiz/client/i18n';
import { SyncService } from '@world-quiz/client/progress';
import {
  Dialog,
  EmptyState,
  PageHeader,
  recordShareCard,
  RegionOptions,
  shareClaim,
  SHARE_TARGET,
  shareCardFile,
  shareLines,
  Toasts,
  type ShareCard,
} from '@world-quiz/client/ui';
import { APP_URL } from '@world-quiz/client/quiz-ports';
import {
  type LeaderboardEntry,
  leaderboardSchema,
  type MyRecord,
  myRecordsSchema,
} from '@world-quiz/shared/contracts';
import {
  DEFAULT_FIXED_QUESTION_COUNT,
  type Difficulty,
  DIFFICULTIES,
  formatRunTime,
  type LeaderboardBoardId,
  leaderboardBoardById,
  leaderboardBoardFor,
  isQuizScope,
  type LeaderboardMetric,
  QUIZ_CATEGORIES,
  type QuizCategory,
  type QuizScope,
  type RankedMode,
  RANKED_MODES,
} from '@world-quiz/quiz/domain';
import { LastSetupStore } from '../core/last-setup.store';
import { regionOptions } from '../core/region-options';

const LEADERBOARD_VIEWS = ['global', 'mine'] as const;
type LeaderboardView = (typeof LEADERBOARD_VIEWS)[number];

function isLeaderboardView(value: unknown): value is LeaderboardView {
  return (LEADERBOARD_VIEWS as readonly unknown[]).includes(value);
}

/** Who a ranking is over: everybody who plays, or the player's friends. */
const BOARD_AUDIENCES = ['everyone', 'friends'] as const;
type BoardAudience = (typeof BOARD_AUDIENCES)[number];

function isBoardAudience(value: unknown): value is BoardAudience {
  return (BOARD_AUDIENCES as readonly unknown[]).includes(value);
}

/** A row of the ranking, or the player's own record, as the list shows it. */
interface BoardRow {
  readonly rank: number;
  readonly name: string;
  /** What the board ranks by, in words ("4:07.3" or "21 correct"). */
  readonly score: string;
  /** The run's own time, shown only where the score counts answers. */
  readonly time: string | null;
  readonly me: boolean;
}

/**
 * The public boards and the player's own records (docs/domain/leaderboard.md).
 *
 * A board is the four settings a quiz is played with — category, region,
 * difficulty and ranked mode — so there are 56 of them, and they are chosen
 * with the very controls the quiz setup asks those questions with: the same
 * question must not look like a different one from screen to screen.
 *
 * The ranking itself opens **over** the page when the player asks for it.
 * Four choices and a table do not fit on a phone together, and the table is
 * what they came for; under the choices it would start a screen down.
 *
 * Nothing is started here. Any game in a ranked mode competes, and the API
 * answers the finished session with the place it earned — so this screen
 * shows boards and never opens a quiz.
 *
 * Records are loaded when the tab is shown and after every sync: a finished
 * run reaches the API through the sync, and Ionic may show this page again
 * from its cache without `ionViewWillEnter`.
 */
@Component({
  selector: 'wq-leaderboard-page',
  imports: [
    IonContent,
    PageHeader,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    TranslocoPipe,
    PluralPipe,
    EmptyState,
    RegionOptions,
    Dialog,
  ],
  templateUrl: './leaderboard.page.html',
  styleUrl: './leaderboard.page.scss',
})
export class LeaderboardPage implements ViewWillEnter {
  private readonly apiUrl = inject(AUTH_CONFIG).apiUrl;
  private readonly sync = inject(SyncService);
  private readonly toasts = inject(Toasts);
  private readonly shareTarget = inject(SHARE_TARGET);
  /** Where this deployment lives, for the link in a shared record. */
  private readonly appUrl = inject(APP_URL);
  private readonly transloco = inject(TranslocoService);
  private readonly lastSetup = inject(LastSetupStore);

  protected readonly categories = QUIZ_CATEGORIES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly modes = RANKED_MODES;
  /** The regions, named and counted exactly as the quiz setup names them. */
  protected readonly regionOptions = regionOptions();

  /** The same icons the setup screen gives these choices. */
  protected readonly categoryIcons: Readonly<Record<QuizCategory, string>> = {
    capitals: 'business-outline',
    flags: 'flag-outline',
  };
  protected readonly difficultyIcons: Readonly<Record<Difficulty, string>> = {
    easy: 'apps-outline',
    hard: 'create-outline',
  };
  protected readonly modeIcons: Readonly<Record<RankedMode, string>> = {
    fixed: 'list-outline',
    timed: 'timer-outline',
  };

  /** How many questions a Quick round asks, for the mode's own sentence. */
  protected readonly metricParams = { count: DEFAULT_FIXED_QUESTION_COUNT };

  protected readonly view = signal<LeaderboardView>('global');

  /**
   * Whose ranking the open board shows. It stays as the player left it from
   * one board to the next: somebody who came to compare with their friends
   * is going to do it again on the next board, not once.
   */
  protected readonly audience = signal<BoardAudience>('everyone');

  /**
   * The picker opens on the board the player last asked for, exactly as the
   * quiz setup opens on the game they last played: answering the same four
   * questions before every look is work the app can do once. A
   * `linkedSignal` lets the player move each choice freely while the screen
   * still starts from what was remembered.
   */
  protected readonly category = linkedSignal<QuizCategory>(
    () => this.lastSetup.board().category,
  );
  protected readonly scope = linkedSignal<QuizScope>(
    () => this.lastSetup.board().scope,
  );
  protected readonly difficulty = linkedSignal<Difficulty>(
    () => this.lastSetup.board().difficulty,
  );
  protected readonly mode = linkedSignal<RankedMode>(
    () => this.lastSetup.board().mode,
  );

  /** The board those four choices stand for. */
  protected readonly board = computed(() =>
    leaderboardBoardFor(
      this.category(),
      this.difficulty(),
      this.scope(),
      this.mode(),
    ),
  );

  /**
   * The board being shown, or `null` while the player is still choosing.
   *
   * Nothing is loaded until they ask for it: four choices and a table do not
   * fit on one phone screen, so the table opens over the page instead of
   * waiting below it, and a board is fetched when it is actually looked at.
   */
  protected readonly shown = signal<LeaderboardBoardId | null>(null);

  /**
   * The ranking of the board being shown.
   *
   * The two endpoints answer with the same thing — the public board is the
   * same query over everybody, the friends board over the player and the
   * people they know, numbered from 1 either way (ADR-015).
   */
  protected readonly ranking = httpResource(
    () => {
      const board = this.shown();
      if (!board) return undefined;
      return this.audience() === 'friends'
        ? `${this.apiUrl}/v1/friends/leaderboards/${board}`
        : `${this.apiUrl}/v1/leaderboards/${board}`;
    },
    { parse: (body) => leaderboardSchema.parse(body) },
  );

  /** The player's best run per board, and their place on each. */
  protected readonly records = httpResource(
    () => `${this.apiUrl}/v1/me/records`,
    { parse: (body) => myRecordsSchema.parse(body) },
  );

  private readonly myRecords = computed(() =>
    this.records.hasValue() ? this.records.value().records : [],
  );

  /** The player's own record on the board being shown, if they have one. */
  protected readonly myRecord = computed(
    () =>
      this.myRecords().find((record) => record.board === this.shown()) ?? null,
  );

  protected readonly entries = computed<BoardRow[]>(() => {
    const board = this.shown();
    if (!board || !this.ranking.hasValue()) return [];
    const mine = this.myRecord();
    const metric = leaderboardBoardById(board).metric;
    // Which row is the player's own.
    //
    // On the public board it is the one at their rank: `/v1/me/records`
    // carries the place that board gave them, and places on it are unique.
    // A board of friends numbers its places over fewer people, so that
    // number names somebody else's row there; what both answers carry
    // about the same run is the moment the server recorded it, and the
    // nickname beside it. Two runs can share a millisecond — the ranking
    // itself breaks that tie by session — so **one** row is marked, not
    // every row that matches.
    const isMine =
      this.audience() === 'friends'
        ? (entry: LeaderboardEntry) =>
            entry.recordedAt === mine?.recordedAt &&
            entry.nickname === mine?.nickname
        : (entry: LeaderboardEntry) => entry.rank === mine?.rank;
    let marked = false;
    return this.ranking.value().entries.map((entry) => {
      const me = Boolean(mine) && !marked && isMine(entry);
      if (me) marked = true;
      return {
        rank: entry.rank,
        name: entry.nickname,
        score: this.scoreText(entry.score, metric),
        time: metric === 'correct' ? formatRunTime(entry.timeMs) : null,
        me,
      };
    });
  });

  /** How many players have a ranked run on the board being shown. */
  protected readonly players = computed(() =>
    this.ranking.hasValue() ? this.ranking.value().players : 0,
  );

  /**
   * The player's own row, pinned under the list when their place is below
   * the page shown — the board is worth looking at even from #248.
   */
  protected readonly myRow = computed<BoardRow | null>(() => {
    const mine = this.myRecord();
    if (!mine) return null;
    const shown = this.entries().some((entry) => entry.me);
    // Only the public board can be too long to find yourself on. A board of
    // friends holds everyone it has, and the player's global rank would be
    // the wrong number to pin under it.
    if (shown || this.audience() === 'friends') return null;
    return this.rowOf(mine);
  });

  /** Every board the player has a record on, best place first. */
  protected readonly recordRows = computed(() =>
    this.myRecords().map((record) => ({
      board: record.board,
      name: this.boardName(record.board),
      row: this.rowOf(record),
      record,
    })),
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
    this.records.reload();
    if (this.shown()) this.ranking.reload();
  }

  /**
   * Opens the board the four choices describe. Asking for the same board
   * again is a request to look again, not a no-op: a run the player has
   * just finished may have reached it since.
   */
  protected show(): void {
    const { id } = this.board();
    this.lastSetup.rememberBoard({
      category: this.category(),
      scope: this.scope(),
      difficulty: this.difficulty(),
      mode: this.mode(),
    });
    if (this.shown() === id) this.ranking.reload();
    else this.shown.set(id);
  }

  /**
   * The same four settings as two lines, for the ranking dialog: what is
   * asked and where, then how it is played. One line wrapped after the
   * third setting on a phone, which reads as an accident rather than as a
   * grouping.
   */
  protected boardLines(id: LeaderboardBoardId): {
    readonly subject: string;
    readonly style: string;
  } {
    const board = leaderboardBoardById(id);
    return {
      subject: this.transloco.translate('leaderboard.boardSubject', {
        category: this.transloco.translate(`categories.${board.category}`),
        region: this.transloco.translate(`regions.${board.scope}`),
      }),
      style: this.transloco.translate('leaderboard.boardStyle', {
        difficulty: this.transloco.translate(`difficulty.${board.difficulty}`),
        mode: this.transloco.translate(`modes.${board.mode}`),
      }),
    };
  }

  /** The four settings a board stands for, in the player's language. */
  protected boardName(id: LeaderboardBoardId): string {
    const board = leaderboardBoardById(id);
    return this.transloco.translate('leaderboard.boardName', {
      category: this.transloco.translate(`categories.${board.category}`),
      region: this.transloco.translate(`regions.${board.scope}`),
      difficulty: this.transloco.translate(`difficulty.${board.difficulty}`),
      mode: this.transloco.translate(`modes.${board.mode}`),
    });
  }

  /** What a score means on a board: a time, or a number of answers. */
  private scoreText(score: number, metric: LeaderboardMetric): string {
    return metric === 'time'
      ? formatRunTime(score)
      : this.transloco.translate('leaderboard.correct', { correct: score });
  }

  private rowOf(record: MyRecord): BoardRow {
    const metric = leaderboardBoardById(record.board).metric;
    return {
      rank: record.rank,
      // The player's own nickname, as the board shows it to everyone else.
      name: record.nickname,
      score: this.scoreText(record.score, metric),
      time: metric === 'correct' ? formatRunTime(record.timeMs) : null,
      me: true,
    };
  }

  /** `wq-region-options` hands back a plain string, as the setup does. */
  protected selectScope(scope: string): void {
    if (isQuizScope(scope)) this.scope.set(scope);
  }

  // `ionChange` is a DOM event for Angular's strict templates, so the Ionic
  // event type is applied here and the value is validated before use.
  protected onViewChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isLeaderboardView(value)) this.view.set(value);
  }

  protected onAudienceChange(event: Event): void {
    const { value } = (event as SegmentCustomEvent).detail;
    if (isBoardAudience(value)) this.audience.set(value);
  }

  /**
   * Hands a personal record to the device's share sheet, or to the clipboard
   * where there is none. The board and the place are translated here, in the
   * player's language, because what is shared is a sentence, not data.
   */
  protected async shareRecord(record: MyRecord): Promise<void> {
    const metric = leaderboardBoardById(record.board).metric;
    const facts = {
      board: this.boardName(record.board),
      // The picture writes the figure big and labels it underneath; the
      // message below has no room for a label and spells it out instead.
      score:
        metric === 'time' ? formatRunTime(record.score) : `${record.score}`,
      scoreLabel: this.transloco.translate(
        metric === 'time' ? 'results.time' : 'results.board.answers',
      ),
      rank: record.rank,
      players: record.players,
      // A record looked up here was set some time ago: it is the player's
      // best, but it is not news, so the picture claims the place instead.
      fresh: false,
    };
    const outcome = await this.shareTarget.share({
      title: this.transloco.translate('share.title'),
      // Where a picture cannot travel, the message says the same things in
      // the same order, starting with the claim the picture leads with.
      text: shareLines(
        this.transloco.translate(
          `share.claim.${shareClaim({
            rank: facts.rank,
            players: facts.players,
          })}`,
        ),
        this.transloco.translate('share.record.score', {
          score: this.scoreText(record.score, metric),
          place: this.transloco.translate('leaderboard.place', {
            rank: facts.rank,
            players: facts.players,
          }),
        }),
        facts.board,
      ),
      ...(this.appUrl ? { url: this.appUrl } : {}),
      image: () => shareCardFile(this.recordCard(facts)),
    });
    if (outcome === 'copied') {
      this.toasts.success(this.transloco.translate('share.copied'));
    } else if (outcome === 'failed') {
      this.toasts.failure(this.transloco.translate('share.failed'));
    }
  }

  /** The words of the picture; the layout is `recordShareCard`'s business. */
  private recordCard(facts: Parameters<typeof recordShareCard>[0]): ShareCard {
    return recordShareCard(facts, (key, params) =>
      this.transloco.translate(key, params),
    );
  }
}
