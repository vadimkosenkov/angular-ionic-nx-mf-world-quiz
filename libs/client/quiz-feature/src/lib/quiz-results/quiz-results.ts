import {
  afterNextRender,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { QuizSessionOutcome } from '@world-quiz/client/quiz-ports';
import type { RankedOutcome } from '@world-quiz/shared/contracts';
import { APP_URL, COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import {
  recordShareCard,
  SHARE_TARGET,
  shareCardFile,
  shareLines,
  Toasts,
  type ShareCard,
} from '@world-quiz/client/ui';
import { Feedback } from '@world-quiz/client/feedback';
import { SettingsStore } from '@world-quiz/client/settings';
import { runShareCard, type SharedQuizMode } from './result-share-card';
import {
  displayAnswer,
  formatRunTime,
  indexCountriesByCode,
  leaderboardBoardById,
  leaderboardMetricOf,
  type QuizConfig,
  type SessionSummary,
} from '@world-quiz/quiz/domain';

/**
 * The place a run earned on a public board, as it arrives: being graded by
 * the API, its answer, or nothing (offline: the run waits in the outbox and
 * reaches the board with the next sync).
 */
export type BoardPlace =
  | { readonly status: 'checking' }
  | { readonly status: 'ranked'; readonly outcome: RankedOutcome }
  | { readonly status: 'unsent' };

/** Result screen of a finished session: score, accuracy, time and what to review. */
@Component({
  selector: 'wq-quiz-results',
  imports: [IonButton, IonIcon, TranslocoPipe],
  templateUrl: './quiz-results.html',
  styleUrl: './quiz-results.scss',
})
export class QuizResults {
  constructor() {
    // The screen announces itself once: a small fanfare for a perfect run,
    // an achievement or a record, a plain note otherwise.
    afterNextRender(() => {
      const worthCelebrating =
        this.summary().perfect ||
        (this.outcome()?.newlyUnlocked.length ?? 0) > 0 ||
        this.place()?.status === 'ranked';
      this.feedback.play(worthCelebrating ? 'celebrate' : 'finished');
    });
  }

  readonly config = input.required<QuizConfig>();
  readonly summary = input.required<SessionSummary>();
  readonly outcome = input<QuizSessionOutcome | null>(null);
  /** Where the run landed on a public board, when it can reach one. */
  readonly place = input<BoardPlace | null>(null);

  readonly playAgain = output<void>();
  readonly exited = output<void>();

  private readonly settings = inject(SettingsStore);
  private readonly feedback = inject(Feedback);
  private readonly shareTarget = inject(SHARE_TARGET);
  private readonly toasts = inject(Toasts);
  private readonly transloco = inject(TranslocoService);
  /** Where this deployment lives; empty in the app, which has no address. */
  private readonly appUrl = inject(APP_URL);
  protected readonly sharing = signal(false);
  private readonly countries = indexCountriesByCode(inject(COUNTRY_DATASET));

  protected readonly formatRunTime = formatRunTime;

  /** What the board of a ranked run counts: a time, or correct answers. */
  protected readonly metric = computed(() => {
    const place = this.place();
    return place?.status === 'ranked'
      ? leaderboardMetricOf(place.outcome.board)
      : null;
  });

  /** The run beat the player's own best on this board: the loud case. */
  protected readonly personalRecord = computed(() => {
    const place = this.place();
    return place?.status === 'ranked' && place.outcome.personalRecord;
  });

  /**
   * A place in the first three, which the card marks with a medal. Below
   * that the number speaks for itself, and a medal for #47 would be a lie.
   */
  protected readonly medal = computed(() => {
    const place = this.place();
    if (place?.status !== 'ranked' || place.outcome.rank > 3) return null;
    return place.outcome.rank;
  });

  /** The four settings the board stands for, in the player's language. */
  protected readonly boardName = computed(() => {
    const place = this.place();
    if (place?.status !== 'ranked') return '';
    const board = leaderboardBoardById(place.outcome.board);
    return this.translate('leaderboard.boardName', {
      category: this.translate(`categories.${board.category}`),
      region: this.translate(`regions.${board.scope}`),
      difficulty: this.translate(`difficulty.${board.difficulty}`),
      mode: this.translate(`modes.${board.mode}`),
    });
  });

  protected readonly accuracyPercent = computed(() =>
    Math.round(this.summary().accuracy * 100),
  );

  protected readonly duration = computed(() => {
    const ms = this.summary().durationMs ?? 0;
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = `${totalSeconds % 60}`.padStart(2, '0');
    return `${minutes}:${seconds}`;
  });

  /** Countries answered incorrectly in this session, with their correct answer. */
  protected readonly mistakes = computed(() => {
    const locale = this.settings.locale();
    const category = this.config().category;
    return this.summary().mistakes.map((code) => {
      const country = this.countries.get(code);
      return {
        code,
        country: country?.name[locale] ?? code,
        answer: country ? displayAnswer(country, category, locale) : '',
      };
    });
  });

  /**
   * Hands the run to whatever the device shares with: a picture of the run
   * through the system sheet on a phone, the same run as text where files
   * cannot be shared, the clipboard where there is no sheet at all. Only
   * the two outcomes the player cannot see for themselves are reported —
   * the sheet opening is its own confirmation, and closing it was their
   * choice.
   */
  protected async share(): Promise<void> {
    if (this.sharing()) return;
    this.sharing.set(true);
    try {
      const outcome = await this.shareTarget.share({
        title: this.translate('share.title'),
        text: shareLines(
          this.translate('share.result.heading', {
            category: this.translate(`categories.${this.config().category}`),
            region: this.translate(`regions.${this.config().scope}`),
            difficulty: this.translate(
              `difficulty.${this.config().difficulty}`,
            ),
          }),
          this.translate('share.result.score', {
            correct: this.summary().correct,
            answered: this.summary().answered,
            accuracy: this.accuracyPercent(),
            time: this.duration(),
          }),
          this.shareRank(),
        ),
        ...(this.appUrl ? { url: this.appUrl } : {}),
        image: () => shareCardFile(this.shareCard()),
      });
      if (outcome === 'copied') {
        this.toasts.success(this.translate('share.copied'));
      } else if (outcome === 'failed') {
        this.toasts.failure(this.translate('share.failed'));
      }
    } finally {
      this.sharing.set(false);
    }
  }

  /**
   * Hands the **record** to the share sheet: the same picture "My records"
   * shares, because what the player wants to show is the record, not the
   * run that happened to set it. The run's own share stays in the hero's
   * corner, and the two are deliberately different pictures.
   */
  protected async shareRecord(): Promise<void> {
    const place = this.place();
    if (this.sharing() || place?.status !== 'ranked') return;
    this.sharing.set(true);
    try {
      const facts = {
        board: this.boardName(),
        score: this.recordScore(place.outcome),
        rank: place.outcome.rank,
        players: place.outcome.players,
      };
      const outcome = await this.shareTarget.share({
        title: this.translate('share.title'),
        text: shareLines(
          this.translate('share.record.heading', { board: facts.board }),
          this.translate('share.record.score', {
            score: facts.score,
            place: this.translate('leaderboard.place', {
              rank: facts.rank,
              players: facts.players,
            }),
          }),
        ),
        ...(this.appUrl ? { url: this.appUrl } : {}),
        image: () =>
          shareCardFile(
            recordShareCard(facts, (key, params) =>
              this.translate(key, params),
            ),
          ),
      });
      if (outcome === 'copied') {
        this.toasts.success(this.translate('share.copied'));
      } else if (outcome === 'failed') {
        this.toasts.failure(this.translate('share.failed'));
      }
    } finally {
      this.sharing.set(false);
    }
  }

  /** What the board ranks by, as the record card says it. */
  private recordScore(outcome: RankedOutcome): string {
    return leaderboardMetricOf(outcome.board) === 'time'
      ? formatRunTime(outcome.score)
      : this.translate('leaderboard.correct', { correct: outcome.score });
  }

  /** The words of the picture; the layout is `runShareCard`'s business. */
  private shareCard(): ShareCard {
    const summary = this.summary();
    const config = this.config();
    return runShareCard(
      {
        category: config.category,
        scope: config.scope,
        difficulty: config.difficulty,
        mode: this.sharedMode(),
        correct: summary.correct,
        answered: summary.answered,
        accuracyPercent: this.accuracyPercent(),
        duration: this.duration(),
        perfect: summary.perfect,
        rank: this.shareRank(),
      },
      (key, params) => this.translate(key, params),
    );
  }

  /**
   * How the run was played, in the player's terms. Practice Mistakes runs
   * as a Quick round over a fixed set of countries, which is the only
   * configuration that carries `countryCodes`; calling it a Quick round on
   * the picture would name something the player did not choose.
   */
  private sharedMode(): SharedQuizMode {
    const config = this.config();
    return config.countryCodes?.length ? 'practice' : config.mode;
  }

  /** A place on a public board is worth a line of its own. */
  private shareRank(): string | null {
    const place = this.place();
    if (place?.status !== 'ranked') return null;
    return this.translate('share.result.rank', {
      rank: place.outcome.rank,
      players: place.outcome.players,
    });
  }

  private translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }
}
