import type { SessionResult } from '@world-quiz/shared/contracts';
import type {
  AnswerJudgement,
  QuizConfig,
  SessionEndReason,
  SubmittedAnswer,
} from '@world-quiz/quiz/domain';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/database';
import { quizAnswers, quizSessions } from '../db/schema';

/** A graded session, ready to be stored. All numbers come from the replay. */
export interface NewSession {
  readonly id: string;
  /** The signed-in player the session belongs to. */
  readonly userId: string;
  readonly config: QuizConfig;
  readonly seed: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly endReason: SessionEndReason;
  readonly answered: number;
  readonly correct: number;
  readonly durationMs: number;
  readonly completed: boolean;
  readonly perfect: boolean;
  readonly requestHash: string;
  /** When the server accepted the session (from the injected clock). */
  readonly recordedAt: number;
  readonly answers: readonly {
    readonly countryCode: string;
    readonly answer: SubmittedAnswer;
    readonly correct: boolean;
    readonly judgement: AnswerJudgement;
    readonly answeredAt: number;
  }[];
}

export interface StoredSession {
  readonly result: SessionResult;
  readonly requestHash: string;
  readonly userId: string;
}

/** Persistence of graded sessions. Knows SQL, not quiz rules. */
export interface SessionRepository {
  findById(id: string): Promise<StoredSession | null>;
  /**
   * Stores the session and its answers atomically. Nothing is written when a
   * session with this id already exists (`exists`: a retry or a concurrent
   * duplicate) or when the owner no longer exists (`owner-missing`: the
   * account was deleted while an access token was still valid).
   */
  insert(session: NewSession): Promise<'inserted' | 'exists' | 'owner-missing'>;
}

export function createSessionRepository(db: Database): SessionRepository {
  return {
    async findById(id) {
      const [row] = await db
        .select()
        .from(quizSessions)
        .where(eq(quizSessions.id, id))
        .limit(1);
      if (!row) return null;

      return {
        requestHash: row.requestHash,
        userId: row.userId,
        result: {
          id: row.id,
          config: row.config,
          summary: {
            answered: row.answered,
            correct: row.correct,
            incorrect: row.answered - row.correct,
            accuracy: row.answered === 0 ? 0 : row.correct / row.answered,
            durationMs: row.durationMs,
            endReason: row.endReason as SessionEndReason,
            completed: row.completed,
            perfect: row.perfect,
          },
          recordedAt: row.recordedAt.toISOString(),
        },
      };
    },

    async insert(session) {
      try {
        return await insertWithAnswers(session);
      } catch (error) {
        if (isForeignKeyViolation(error)) return 'owner-missing';
        throw error;
      }
    },
  };

  function insertWithAnswers(session: NewSession) {
    return db.transaction(async (tx) => {
      const inserted = await tx
        .insert(quizSessions)
        .values({
          id: session.id,
          userId: session.userId,
          category: session.config.category,
          difficulty: session.config.difficulty,
          mode: session.config.mode,
          scope: session.config.scope,
          config: session.config,
          seed: session.seed,
          startedAt: new Date(session.startedAt),
          finishedAt: new Date(session.finishedAt),
          endReason: session.endReason,
          answered: session.answered,
          correct: session.correct,
          durationMs: session.durationMs,
          completed: session.completed,
          perfect: session.perfect,
          requestHash: session.requestHash,
          recordedAt: new Date(session.recordedAt),
        })
        // Two identical requests racing each other: exactly one inserts.
        .onConflictDoNothing({ target: quizSessions.id })
        .returning({ id: quizSessions.id });

      if (inserted.length === 0) return 'exists' as const;

      if (session.answers.length > 0) {
        await tx.insert(quizAnswers).values(
          session.answers.map((answer, sequence) => ({
            sessionId: session.id,
            sequence,
            countryCode: answer.countryCode,
            answer: answer.answer,
            correct: answer.correct,
            judgement: answer.judgement,
            answeredAt: new Date(answer.answeredAt),
          })),
        );
      }
      return 'inserted' as const;
    });
  }
}

/** PostgreSQL `foreign_key_violation`, possibly wrapped by Drizzle. */
function isForeignKeyViolation(error: unknown): boolean {
  const codeOf = (value: unknown) => (value as { code?: unknown } | null)?.code;
  return (
    codeOf(error) === '23503' ||
    codeOf((error as { cause?: unknown } | null)?.cause) === '23503'
  );
}
