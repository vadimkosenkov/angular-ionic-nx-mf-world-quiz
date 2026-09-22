import type {
  SessionHistoryEntry,
  SessionResult,
} from '@world-quiz/shared/contracts';
import type {
  AnswerJudgement,
  QuizConfig,
  SessionEndReason,
  SubmittedAnswer,
} from '@world-quiz/quiz/domain';
import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../db/database';
import { quizAnswers, quizSessions } from '../db/schema';
import type { HistoryPosition } from './history-cursor';

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

/** A history entry with the position it has in the player's history. */
export interface HistoryRow {
  readonly entry: SessionHistoryEntry;
  readonly position: HistoryPosition;
}

export interface HistoryQuery {
  readonly userId: string;
  /** Only sessions after this position; from the beginning when `null`. */
  readonly after: HistoryPosition | null;
  /** Only sessions recorded at or before this time (epoch milliseconds). */
  readonly recordedUntil: number;
  readonly limit: number;
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
  /**
   * The player's sessions in `(recordedAt, id)` order, each with its graded
   * answers in the order they were given.
   */
  history(query: HistoryQuery): Promise<HistoryRow[]>;
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
        result: toResult(row),
      };
    },

    async history({ userId, after, recordedUntil, limit }) {
      const rows = await db
        .select()
        .from(quizSessions)
        .where(
          and(
            eq(quizSessions.userId, userId),
            lte(quizSessions.recordedAt, new Date(recordedUntil)),
            after
              ? sql`(${quizSessions.recordedAt}, ${quizSessions.id}) > (${new Date(after.recordedAt).toISOString()}::timestamptz, ${after.id}::uuid)`
              : undefined,
          ),
        )
        .orderBy(asc(quizSessions.recordedAt), asc(quizSessions.id))
        .limit(limit);
      if (rows.length === 0) return [];

      const answers = await db
        .select({
          sessionId: quizAnswers.sessionId,
          countryCode: quizAnswers.countryCode,
          correct: quizAnswers.correct,
          answeredAt: quizAnswers.answeredAt,
        })
        .from(quizAnswers)
        .where(
          inArray(
            quizAnswers.sessionId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(quizAnswers.sessionId), asc(quizAnswers.sequence));

      const answersBySession = new Map<string, typeof answers>();
      for (const answer of answers) {
        const list = answersBySession.get(answer.sessionId) ?? [];
        list.push(answer);
        answersBySession.set(answer.sessionId, list);
      }
      return rows.map((row) => ({
        position: { recordedAt: row.recordedAt.getTime(), id: row.id },
        entry: {
          ...toResult(row),
          startedAt: row.startedAt.getTime(),
          finishedAt: row.finishedAt.getTime(),
          answers: (answersBySession.get(row.id) ?? []).map((answer) => ({
            countryCode: answer.countryCode,
            correct: answer.correct,
            answeredAt: answer.answeredAt.getTime(),
          })),
        },
      }));
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

function toResult(row: typeof quizSessions.$inferSelect): SessionResult {
  return {
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
  };
}

/** PostgreSQL `foreign_key_violation`, possibly wrapped by Drizzle. */
function isForeignKeyViolation(error: unknown): boolean {
  const codeOf = (value: unknown) => (value as { code?: unknown } | null)?.code;
  return (
    codeOf(error) === '23503' ||
    codeOf((error as { cause?: unknown } | null)?.cause) === '23503'
  );
}
