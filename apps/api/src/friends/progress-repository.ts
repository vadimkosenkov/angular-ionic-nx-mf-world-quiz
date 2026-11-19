import type {
  CountryCode,
  Difficulty,
  ProgressEvent,
  QuizCategory,
} from '@world-quiz/quiz/domain';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/database';
import { quizAnswers, quizSessions } from '../db/schema';

/**
 * What a player has learned, as the events the domain rebuilds progress
 * from (`rebuildProgress`).
 *
 * The device keeps its own copy and rebuilds it the same way; this is the
 * server's reading of the same facts, for the one case where the device
 * cannot help — a **friend's** achievements, which only the server has the
 * sessions for. Nothing is stored: mastery is derived, and a stored copy
 * would be a second source of truth that drifts the first time the rules
 * change.
 */
export interface ProgressRepository {
  /** Every answer this player has given, as progress events. */
  events(userId: string): Promise<ProgressEvent[]>;
}

export function createProgressRepository(db: Database): ProgressRepository {
  return {
    async events(userId) {
      const rows = await db
        .select({
          category: quizSessions.category,
          difficulty: quizSessions.difficulty,
          countryCode: quizAnswers.countryCode,
          correct: quizAnswers.correct,
          answeredAt: quizAnswers.answeredAt,
          sessionId: quizAnswers.sessionId,
          sequence: quizAnswers.sequence,
        })
        .from(quizAnswers)
        .innerJoin(quizSessions, eq(quizSessions.id, quizAnswers.sessionId))
        .where(eq(quizSessions.userId, userId))
        .orderBy(asc(quizAnswers.answeredAt), asc(quizAnswers.sequence));
      return rows.map((row) => ({
        category: row.category as QuizCategory,
        countryCode: row.countryCode as CountryCode,
        difficulty: row.difficulty as Difficulty,
        correct: row.correct,
        answeredAt: row.answeredAt.getTime(),
        sessionId: row.sessionId,
        sequence: row.sequence,
      }));
    },
  };
}
