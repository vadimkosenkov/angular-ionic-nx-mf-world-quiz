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
}

/** Persistence of graded sessions. Knows SQL, not quiz rules. */
export interface SessionRepository {
  findById(id: string): Promise<StoredSession | null>;
  /**
   * Stores the session and its answers atomically. Returns `false` when a
   * session with this id already exists (a retry or a concurrent duplicate);
   * nothing is written in that case.
   */
  insert(session: NewSession): Promise<boolean>;
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
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(quizSessions)
          .values({
            id: session.id,
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

        if (inserted.length === 0) return false;

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
        return true;
      });
    },
  };
}
