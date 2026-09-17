import type { Result } from '@world-quiz/shared/util';
import { err, ok } from '@world-quiz/shared/util';
import type { AnswerIndex } from './answer-matching';
import { buildAnswerIndex, matchAnswer } from './answer-matching';
import type { Country, CountryCode, CountryDataset } from './country';
import { countriesInScope, indexCountriesByCode } from './country';
import type { QuestionSource, QuizQuestion } from './questions';
import { createQuestionSource } from './questions';
import type { SessionSummary } from './scoring';
import { summarizeSession } from './scoring';
import type {
  Difficulty,
  QuizCategory,
  QuizMode,
  QuizScope,
} from './vocabulary';
import {
  CHALLENGE_MODE,
  DEFAULT_FIXED_QUESTION_COUNT,
  TIMED_MODE_DURATION_MS,
} from './vocabulary';

export interface QuizConfig {
  readonly category: QuizCategory;
  readonly difficulty: Difficulty;
  readonly mode: QuizMode;
  readonly scope: QuizScope;
  /** Fixed mode only. Defaults to 10; capped at the number of available countries. */
  readonly questionCount?: number;
  /** Restricts the pool to these countries (e.g. Practice Mistakes). Training modes only. */
  readonly countryCodes?: readonly CountryCode[];
}

export type QuizConfigError =
  | 'empty-pool'
  | 'invalid-question-count'
  | 'question-count-requires-fixed-mode'
  | 'unknown-country'
  | 'challenge-requires-world-scope'
  | 'challenge-cannot-be-restricted';

export type SubmittedAnswer =
  | { readonly kind: 'choice'; readonly countryCode: CountryCode }
  | { readonly kind: 'text'; readonly text: string };

/** How an answer was judged. `choice`: Easy-mode selection. `exact`/`typo`: Hard-mode text. */
export type AnswerJudgement = 'choice' | 'exact' | 'typo' | 'incorrect';

export interface AnswerRecord {
  readonly questionIndex: number;
  /** The country the question was about. */
  readonly countryCode: CountryCode;
  readonly answer: SubmittedAnswer;
  readonly correct: boolean;
  readonly judgement: AnswerJudgement;
  /** Hard mode: the accepted answer the input matched (e.g. "Paris" for "Pariss"). */
  readonly matchedText?: string;
  readonly answeredAt: number;
}

export type SessionEndReason = 'completed' | 'stopped' | 'time-up';

/**
 * Immutable state of one quiz session. Every engine operation returns a new
 * object. Questions are not stored: they are regenerated from `seed`.
 *
 * Timestamps are epoch milliseconds from the caller's clock. Clients should
 * use a monotonic source so a device clock change cannot move time backwards.
 */
export interface QuizSession {
  readonly config: QuizConfig;
  readonly seed: string;
  readonly startedAt: number;
  readonly answers: readonly AnswerRecord[];
  readonly status: 'active' | 'finished';
  readonly finishedAt: number | null;
  readonly endReason: SessionEndReason | null;
}

export type SubmitError =
  | 'session-finished'
  | 'time-up'
  | 'answer-kind-mismatch'
  | 'invalid-choice'
  | 'empty-answer'
  | 'timestamp-out-of-order';

export type SubmitResult =
  | {
      readonly ok: true;
      readonly session: QuizSession;
      readonly record: AnswerRecord;
    }
  | {
      readonly ok: false;
      readonly error: SubmitError;
      /** Unchanged, or finalized when the error is `time-up`. */
      readonly session: QuizSession;
    };

/** What a client submits so the server can re-run a finished session. */
export interface SessionRecord {
  readonly config: QuizConfig;
  readonly seed: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly endReason: SessionEndReason;
  readonly submissions: readonly {
    readonly answer: SubmittedAnswer;
    readonly answeredAt: number;
  }[];
}

export type ReplayError =
  | { readonly kind: 'invalid-config'; readonly reason: QuizConfigError }
  | {
      readonly kind: 'invalid-submission';
      readonly index: number;
      readonly reason: SubmitError;
    }
  | { readonly kind: 'inconsistent-ending' };

export interface GradedAnswer {
  readonly correct: boolean;
  readonly judgement: AnswerJudgement;
  readonly matchedText?: string;
}

/**
 * Grades one answer. Pure and shared by client (instant feedback) and server
 * (authoritative re-grading).
 */
export function gradeAnswer(
  question: QuizQuestion,
  difficulty: Difficulty,
  answer: SubmittedAnswer,
  answerIndex: AnswerIndex,
): Result<GradedAnswer, SubmitError> {
  if (difficulty === 'easy') {
    if (answer.kind !== 'choice') return err('answer-kind-mismatch');
    if (!question.choices?.includes(answer.countryCode)) {
      return err('invalid-choice');
    }
    return ok({
      correct: answer.countryCode === question.countryCode,
      judgement:
        answer.countryCode === question.countryCode ? 'choice' : 'incorrect',
    });
  }

  if (answer.kind !== 'text') return err('answer-kind-mismatch');
  if (!answer.text.trim()) return err('empty-answer');

  const match = matchAnswer(answerIndex, question.countryCode, answer.text);
  if (match.kind === 'incorrect') {
    return ok({ correct: false, judgement: 'incorrect' });
  }
  return ok({
    correct: true,
    judgement: match.kind,
    matchedText: match.matchedText,
  });
}

export interface QuizEngine {
  readonly dataset: CountryDataset;
  start(
    config: QuizConfig,
    options: { readonly seed: string; readonly startedAt: number },
  ): Result<QuizSession, QuizConfigError>;
  questions(session: QuizSession): QuestionSource;
  /** The question to answer next, or `null` when the session is finished. */
  currentQuestion(session: QuizSession): QuizQuestion | null;
  submitAnswer(
    session: QuizSession,
    answer: SubmittedAnswer,
    answeredAt: number,
  ): SubmitResult;
  /** Ends the session early (Endless "Stop", or leaving a quiz). */
  stop(session: QuizSession, now: number): QuizSession;
  /** Finalizes a Timed session whose time is up. Otherwise returns it unchanged. */
  expire(session: QuizSession, now: number): QuizSession;
  /** Timed mode: milliseconds left (never negative). `null` for other modes. */
  remainingTimeMs(session: QuizSession, now: number): number | null;
  summarize(session: QuizSession): SessionSummary;
  /** Re-runs a submitted session from scratch and re-grades every answer. */
  replay(record: SessionRecord): Result<QuizSession, ReplayError>;
}

/**
 * Creates the quiz engine for a dataset. Pure functions over immutable state;
 * the engine only caches derived lookup tables.
 */
export function createQuizEngine(dataset: CountryDataset): QuizEngine {
  const countriesByCode = indexCountriesByCode(dataset);
  const answerIndexes = {
    capitals: buildAnswerIndex(dataset, 'capitals'),
    flags: buildAnswerIndex(dataset, 'flags'),
  } satisfies Record<QuizCategory, AnswerIndex>;
  // Sessions are immutable copies, but they share their config object, so
  // question sources are cached per config object and seed.
  const sourceCache = new WeakMap<QuizConfig, Map<string, QuestionSource>>();

  const resolvePool = (
    config: QuizConfig,
  ): Result<
    { pool: readonly Country[]; length: number | null },
    QuizConfigError
  > => {
    if (config.mode === CHALLENGE_MODE) {
      if (config.scope !== 'world')
        return err('challenge-requires-world-scope');
      if (config.countryCodes) return err('challenge-cannot-be-restricted');
    }
    if (config.questionCount !== undefined && config.mode !== 'fixed') {
      return err('question-count-requires-fixed-mode');
    }
    if (config.countryCodes?.some((code) => !countriesByCode.has(code))) {
      return err('unknown-country');
    }

    const restriction = config.countryCodes
      ? new Set(config.countryCodes)
      : null;
    const pool = countriesInScope(dataset, config.scope).filter(
      (country) => !restriction || restriction.has(country.code),
    );
    if (pool.length === 0) return err('empty-pool');

    switch (config.mode) {
      case 'fixed': {
        const requested = config.questionCount ?? DEFAULT_FIXED_QUESTION_COUNT;
        if (!Number.isInteger(requested) || requested < 1) {
          return err('invalid-question-count');
        }
        return ok({ pool, length: Math.min(requested, pool.length) });
      }
      case CHALLENGE_MODE:
        return ok({ pool, length: pool.length });
      case 'endless':
      case 'timed':
        return ok({ pool, length: null });
    }
  };

  const questions = (session: QuizSession): QuestionSource => {
    const bySeed =
      sourceCache.get(session.config) ?? new Map<string, QuestionSource>();
    sourceCache.set(session.config, bySeed);
    const cached = bySeed.get(session.seed);
    if (cached) return cached;

    const resolved = resolvePool(session.config);
    if (!resolved.ok) {
      throw new Error(`Session has an invalid config: ${resolved.error}`);
    }
    const source = createQuestionSource({
      dataset,
      pool: resolved.value.pool,
      difficulty: session.config.difficulty,
      length: resolved.value.length,
      seed: session.seed,
    });
    bySeed.set(session.seed, source);
    return source;
  };

  const deadline = (session: QuizSession): number | null =>
    session.config.mode === 'timed'
      ? session.startedAt + TIMED_MODE_DURATION_MS
      : null;

  const finish = (
    session: QuizSession,
    finishedAt: number,
    endReason: SessionEndReason,
  ): QuizSession => ({ ...session, status: 'finished', finishedAt, endReason });

  const lastActivity = (session: QuizSession): number =>
    session.answers.at(-1)?.answeredAt ?? session.startedAt;

  const expire = (session: QuizSession, now: number): QuizSession => {
    const end = deadline(session);
    if (session.status === 'finished' || end === null || now < end) {
      return session;
    }
    return finish(session, end, 'time-up');
  };

  const currentQuestion = (session: QuizSession): QuizQuestion | null => {
    if (session.status === 'finished') return null;
    return questions(session).questionAt(session.answers.length);
  };

  const submitAnswer = (
    session: QuizSession,
    answer: SubmittedAnswer,
    answeredAt: number,
  ): SubmitResult => {
    if (session.status === 'finished') {
      return { ok: false, error: 'session-finished', session };
    }
    if (answeredAt < lastActivity(session)) {
      return { ok: false, error: 'timestamp-out-of-order', session };
    }
    const expired = expire(session, answeredAt);
    if (expired !== session) {
      return { ok: false, error: 'time-up', session: expired };
    }

    const question = currentQuestion(session) as QuizQuestion;
    const graded = gradeAnswer(
      question,
      session.config.difficulty,
      answer,
      answerIndexes[session.config.category],
    );
    if (!graded.ok) {
      return { ok: false, error: graded.error, session };
    }

    const record: AnswerRecord = {
      questionIndex: question.index,
      countryCode: question.countryCode,
      answer,
      ...graded.value,
      answeredAt,
    };
    const answered: QuizSession = {
      ...session,
      answers: [...session.answers, record],
    };
    const { length } = questions(session);
    const next =
      length !== null && answered.answers.length === length
        ? finish(answered, answeredAt, 'completed')
        : answered;

    return { ok: true, session: next, record };
  };

  const start: QuizEngine['start'] = (config, { seed, startedAt }) => {
    const resolved = resolvePool(config);
    if (!resolved.ok) return resolved;
    return ok({
      config,
      seed,
      startedAt,
      answers: [],
      status: 'active',
      finishedAt: null,
      endReason: null,
    });
  };

  const stop = (session: QuizSession, now: number): QuizSession => {
    if (session.status === 'finished') return session;
    const expired = expire(session, now);
    if (expired !== session) return expired;
    return finish(session, Math.max(now, lastActivity(session)), 'stopped');
  };

  return {
    dataset,

    start,
    questions,
    currentQuestion,
    submitAnswer,
    stop,
    expire,

    remainingTimeMs(session, now) {
      const end = deadline(session);
      if (end === null) return null;
      const effectiveNow = session.finishedAt ?? now;
      return Math.max(0, end - effectiveNow);
    },

    summarize(session) {
      return summarizeSession(session, questions(session).length);
    },

    replay(record) {
      const started = start(record.config, {
        seed: record.seed,
        startedAt: record.startedAt,
      });
      if (!started.ok) {
        return err({ kind: 'invalid-config', reason: started.error });
      }

      let session = started.value;
      for (const [index, submission] of record.submissions.entries()) {
        const result = submitAnswer(
          session,
          submission.answer,
          submission.answeredAt,
        );
        if (!result.ok) {
          return err({
            kind: 'invalid-submission',
            index,
            reason: result.error,
          });
        }
        session = result.session;
      }

      if (record.finishedAt < lastActivity(session)) {
        return err({ kind: 'inconsistent-ending' });
      }

      switch (record.endReason) {
        case 'completed':
          return session.endReason === 'completed' &&
            session.finishedAt === record.finishedAt
            ? ok(session)
            : err({ kind: 'inconsistent-ending' });
        case 'time-up': {
          const expired = expire(session, record.finishedAt);
          return expired.endReason === 'time-up'
            ? ok(expired)
            : err({ kind: 'inconsistent-ending' });
        }
        case 'stopped': {
          if (session.status === 'finished') {
            return err({ kind: 'inconsistent-ending' });
          }
          const stopped = stop(session, record.finishedAt);
          return stopped.endReason === 'stopped'
            ? ok(stopped)
            : err({ kind: 'inconsistent-ending' });
        }
      }
    },
  };
}
