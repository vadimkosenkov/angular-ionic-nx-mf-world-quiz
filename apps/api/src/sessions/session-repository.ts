import type {
  SessionHistoryEntry,
  SessionResult,
} from '@world-quiz/shared/contracts';
import type {
  AnswerJudgement,
  LeaderboardBoardId,
  QuizConfig,
  SessionEndReason,
  SubmittedAnswer,
} from '@world-quiz/quiz/domain';
import {
  and,
  asc,
  eq,
  inArray,
  isNull,
  lte,
  sql,
  TransactionRollbackError,
} from 'drizzle-orm';
import type { Database } from '../db/database';
import { challenges, quizAnswers, quizSessions } from '../db/schema';
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
  /** Challenge sessions: the challenge they play and the server's verdict. */
  readonly challenge?: ChallengeVerdict & { readonly id: string };
}

/** What the server decided about a challenge run. */
export interface ChallengeVerdict {
  readonly board: LeaderboardBoardId;
  /** `ranked`, or why not (`ChallengeUnrankedReason`). */
  readonly outcome: string;
  readonly completionMs: number | null;
  readonly personalRecord: boolean;
}

export interface StoredSession {
  /** Without the challenge outcome, which depends on the current ranking. */
  readonly result: SessionResult;
  readonly requestHash: string;
  readonly userId: string;
  readonly challenge: ChallengeVerdict | null;
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
   * account was deleted while an access token was still valid). A challenge
   * is attached only if no other session has played it (`challenge-used`).
   */
  insert(
    session: NewSession,
  ): Promise<'inserted' | 'exists' | 'owner-missing' | 'challenge-used'>;
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
        .select({ session: quizSessions, challenge: challenges })
        .from(quizSessions)
        .leftJoin(challenges, eq(challenges.sessionId, quizSessions.id))
        .where(eq(quizSessions.id, id))
        .limit(1);
      if (!row) return null;

      const { session, challenge } = row;
      return {
        requestHash: session.requestHash,
        userId: session.userId,
        result: toResult(session),
        challenge: challenge
          ? {
              board: challenge.board as LeaderboardBoardId,
              outcome: challenge.outcome ?? 'ranked',
              completionMs: challenge.completionMs,
              personalRecord: challenge.personalRecord ?? false,
            }
          : null,
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
        if (error instanceof TransactionRollbackError) return 'challenge-used';
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

      if (session.challenge) {
        // Only an unplayed challenge takes the session: two different
        // sessions racing for one challenge cannot both be recorded.
        const attached = await tx
          .update(challenges)
          .set({
            sessionId: session.id,
            outcome: session.challenge.outcome,
            completionMs: session.challenge.completionMs,
            recordedAt: new Date(session.recordedAt),
            personalRecord: session.challenge.personalRecord,
          })
          .where(
            and(
              eq(challenges.id, session.challenge.id),
              eq(challenges.userId, session.userId),
              isNull(challenges.sessionId),
            ),
          )
          .returning({ id: challenges.id });
        if (attached.length === 0) tx.rollback();
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
