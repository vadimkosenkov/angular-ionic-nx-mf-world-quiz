import { asc, eq } from 'drizzle-orm';
import type { Database } from '../db/database';
import { quizAnswers } from '../db/schema';

/** The stored answers of a session, in order, as tests compare them. */
export async function readAnswers(db: Database, sessionId: string) {
  const rows = await db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.sessionId, sessionId))
    .orderBy(asc(quizAnswers.sequence));
  return rows.map((row) => ({
    countryCode: row.countryCode,
    answer: row.answer,
    correct: row.correct,
    judgement: row.judgement,
    answeredAt: row.answeredAt.getTime(),
  }));
}
