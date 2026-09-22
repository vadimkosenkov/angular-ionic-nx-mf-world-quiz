import type {
  SessionHistoryEntry,
  SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import {
  type ProgressEvent,
  type QuizSession,
  sessionProgressEvents,
} from '@world-quiz/quiz/domain';
import type { LocalSession } from './local-store';

/**
 * A session finished on this device, ready for the outbox: its progress
 * events (graded here, exactly as the server will grade them) and the
 * request that records it. The request carries only what the player did.
 */
export function playedSession(session: QuizSession, id: string): LocalSession {
  if (session.finishedAt === null || session.endReason === null) {
    throw new Error('Only finished sessions are recorded');
  }
  const request: SubmitSessionRequest = {
    id,
    config: session.config,
    seed: session.seed,
    startedAt: session.startedAt,
    finishedAt: session.finishedAt,
    endReason: session.endReason,
    submissions: session.answers.map(({ answer, answeredAt }) => ({
      answer,
      answeredAt,
    })),
  };
  return {
    id,
    sync: 'pending',
    finishedAt: session.finishedAt,
    events: sessionProgressEvents(session, id),
    request,
  };
}

/** A session from the account's history, graded by the server. */
export function pulledSession(entry: SessionHistoryEntry): LocalSession {
  const events: ProgressEvent[] = entry.answers.map((answer, sequence) => ({
    category: entry.config.category,
    difficulty: entry.config.difficulty,
    countryCode: answer.countryCode,
    correct: answer.correct,
    answeredAt: answer.answeredAt,
    sessionId: entry.id,
    sequence,
  }));
  return { id: entry.id, sync: 'synced', finishedAt: entry.finishedAt, events };
}
