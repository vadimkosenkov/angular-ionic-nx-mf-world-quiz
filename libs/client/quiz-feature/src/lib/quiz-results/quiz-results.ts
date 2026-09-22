import { Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import type { QuizSessionOutcome } from '@world-quiz/client/quiz-ports';
import type { ChallengeOutcome } from '@world-quiz/shared/contracts';
import { COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import { SettingsStore } from '@world-quiz/client/settings';
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
  readonly config = input.required<QuizConfig>();
  readonly summary = input.required<SessionSummary>();
  readonly outcome = input<QuizSessionOutcome | null>(null);
  /** Leaderboard challenges only. */
  readonly challenge = input<ChallengeResult | null>(null);

  readonly playAgain = output<void>();
  readonly exited = output<void>();

  private readonly settings = inject(SettingsStore);
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
}
