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
import type { ChallengeOutcome } from '@world-quiz/shared/contracts';
import { APP_URL, COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import {
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
  type QuizConfig,
  type SessionSummary,
} from '@world-quiz/quiz/domain';

/**
 * A challenge run's verdict as it arrives: being checked by the server, the
 * server's answer, or not sent (offline: it waits in the outbox).
 */
export type ChallengeResult =
  | { readonly status: 'checking' }
  | { readonly status: 'done'; readonly outcome: ChallengeOutcome }
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
        this.challenge()?.status === 'done';
      this.feedback.play(worthCelebrating ? 'celebrate' : 'finished');
    });
  }

  readonly config = input.required<QuizConfig>();
  readonly summary = input.required<SessionSummary>();
  readonly outcome = input<QuizSessionOutcome | null>(null);
  /** Leaderboard challenges only. */
  readonly challenge = input<ChallengeResult | null>(null);

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
  protected readonly isChallenge = computed(
    () => this.config().mode === 'challenge',
  );

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

  /** A challenge the server ranked is worth a line of its own. */
  private shareRank(): string | null {
    const challenge = this.challenge();
    if (challenge?.status !== 'done' || !challenge.outcome.ranked) return null;
    return this.translate('share.result.rank', {
      rank: challenge.outcome.rank,
    });
  }

  private translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }
}
