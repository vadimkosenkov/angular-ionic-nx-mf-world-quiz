import { computed, inject, Injectable, signal } from '@angular/core';
import { CLOCK, COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import type {
  AnswerRecord,
  Country,
  QuizConfig,
  QuizQuestion,
  QuizSession,
  SubmitError,
} from '@world-quiz/quiz/domain';
import {
  createQuizEngine,
  indexCountriesByCode,
} from '@world-quiz/quiz/domain';

/** What the UI shows after an answer, before moving to the next question. */
export interface AnswerFeedback {
  readonly record: AnswerRecord;
  /** The country that was asked, for showing the correct answer. */
  readonly country: Country;
}

/**
 * One quiz session, as signals.
 *
 * The rules live in `quiz-domain`; this store only holds the current session,
 * exposes it to components and feeds in time from the injected clock. It is
 * provided per quiz page, not in root: each page plays exactly one session.
 */
@Injectable()
export class QuizSessionStore {
  private readonly dataset = inject(COUNTRY_DATASET);
  private readonly clock = inject(CLOCK);
  private readonly engine = createQuizEngine(this.dataset);
  private readonly countries = indexCountriesByCode(this.dataset);

  private readonly session = signal<QuizSession | null>(null);
  private readonly feedbackState = signal<AnswerFeedback | null>(null);
  /** Updated by the page's timer so time-based signals stay live. */
  private readonly now = signal(0);
  private readonly lastError = signal<SubmitError | null>(null);

  readonly config = computed(() => this.session()?.config ?? null);
  readonly status = computed(() => this.session()?.status ?? 'idle');
  readonly feedback = this.feedbackState.asReadonly();
  readonly error = this.lastError.asReadonly();

  /** The question to answer, or `null` while feedback is shown or when finished. */
  readonly question = computed<QuizQuestion | null>(() => {
    const session = this.session();
    if (!session || this.feedbackState()) return null;
    return this.engine.currentQuestion(session);
  });

  /** The country of the current question or of the answer being reviewed. */
  readonly country = computed<Country | null>(() => {
    const code =
      this.question()?.countryCode ?? this.feedbackState()?.record.countryCode;
    return code ? (this.countries.get(code) ?? null) : null;
  });

  /**
   * The country of the question **after** this one, so its flag can be
   * fetched while the player is still answering. Without that, pressing
   * Continue shows the new answers next to the previous flag until the new
   * image arrives.
   */
  readonly nextCountry = computed<Country | null>(() => {
    const session = this.session();
    if (!session || session.status === 'finished') return null;
    const source = this.engine.questions(session);
    const next = session.answers.length + 1;
    if (source.length !== null && next >= source.length) return null;
    const code = source.questionAt(next).countryCode;
    return this.countries.get(code) ?? null;
  });

  readonly summary = computed(() => {
    const session = this.session();
    return session ? this.engine.summarize(session) : null;
  });

  /** Number of questions planned, or `null` for Endless and Timed. */
  readonly total = computed(() => {
    const session = this.session();
    return session ? this.engine.questions(session).length : null;
  });

  readonly answeredCount = computed(() => this.session()?.answers.length ?? 0);

  /** 1-based position of the current question. */
  readonly position = computed(() =>
    Math.min(
      this.answeredCount() + (this.feedbackState() ? 0 : 1),
      this.total() ?? Infinity,
    ),
  );

  readonly correctCount = computed(() => this.summary()?.correct ?? 0);

  readonly remainingMs = computed(() => {
    const session = this.session();
    return session ? this.engine.remainingTimeMs(session, this.now()) : null;
  });

  readonly finishedSession = computed(() => {
    const session = this.session();
    return session?.status === 'finished' ? session : null;
  });

  start(config: QuizConfig, seed: string): void {
    const now = this.clock.now();
    this.now.set(now);
    const started = this.engine.start(config, { seed, startedAt: now });
    if (!started.ok) {
      throw new Error(`Invalid quiz configuration: ${started.error}`);
    }
    this.session.set(started.value);
    this.feedbackState.set(null);
    this.lastError.set(null);
  }

  /** Called by the page's ticker; also finalizes a Timed session when time is up. */
  tick(): void {
    const session = this.session();
    if (!session) return;
    const now = this.clock.now();
    this.now.set(now);
    const expired = this.engine.expire(session, now);
    if (expired !== session) {
      this.feedbackState.set(null);
      this.session.set(expired);
    }
  }

  answerChoice(countryCode: string): void {
    this.submit({ kind: 'choice', countryCode });
  }

  answerText(text: string): void {
    this.submit({ kind: 'text', text });
  }

  /** Moves from the feedback state to the next question. */
  continue(): void {
    this.feedbackState.set(null);
  }

  /** Ends the session early (Endless "Stop", or leaving the quiz). */
  stop(): void {
    const session = this.session();
    if (!session) return;
    this.feedbackState.set(null);
    this.session.set(this.engine.stop(session, this.clock.now()));
  }

  private submit(
    answer:
      { kind: 'choice'; countryCode: string } | { kind: 'text'; text: string },
  ): void {
    const session = this.session();
    if (!session || this.feedbackState()) return;

    const answeredAt = this.clock.now();
    this.now.set(answeredAt);
    const result = this.engine.submitAnswer(session, answer, answeredAt);
    this.session.set(result.session);

    if (!result.ok) {
      this.lastError.set(result.error);
      return;
    }

    this.lastError.set(null);
    const country = this.countries.get(result.record.countryCode);
    if (country) {
      this.feedbackState.set({ record: result.record, country });
    }
  }
}
