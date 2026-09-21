import type {
  SessionResult,
  SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import type { QuizEngine, ReplayError } from '@world-quiz/quiz/domain';
import type { Clock } from '@world-quiz/shared/util';
import { requestHash } from './request-hash';
import type { NewSession, SessionRepository } from './session-repository';

/** How far a client clock may run ahead of the server's. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
/** No session is played for longer than a day; older data is not a session. */
export const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** Why a well-formed session was refused. */
export type SessionRejection =
  | ReplayError['kind']
  | 'finished-in-the-future'
  | 'finished-before-start'
  | 'too-long';

export type SubmitSessionOutcome =
  | { readonly kind: 'created'; readonly result: SessionResult }
  /** The same session was already recorded (a retry): nothing new stored. */
  | { readonly kind: 'duplicate'; readonly result: SessionResult }
  /** The id is taken by a different session. */
  | { readonly kind: 'conflict' }
  /** The signed-in account was deleted meanwhile. */
  | { readonly kind: 'owner-missing' }
  | { readonly kind: 'rejected'; readonly reason: SessionRejection };

export interface SessionService {
  /** Records a session for the signed-in player `userId`. */
  submit(
    request: SubmitSessionRequest,
    userId: string,
  ): Promise<SubmitSessionOutcome>;
  /** The player's own session; other players' sessions do not exist for them. */
  find(id: string, userId: string): Promise<SessionResult | null>;
}

export interface SessionServiceDependencies {
  readonly repository: SessionRepository;
  readonly engine: QuizEngine;
  readonly clock: Clock;
}

/**
 * Records finished quiz sessions.
 *
 * The client's request says what the player did; this service decides what it
 * was worth. It replays the session with the same quiz domain the client ran,
 * which re-generates the questions from the seed and re-grades every answer,
 * and stores only the server's results. A request that cannot be replayed is
 * refused, not "corrected".
 */
export function createSessionService({
  repository,
  engine,
  clock,
}: SessionServiceDependencies): SessionService {
  /**
   * A second request with the same id: the same player's retry, or a
   * different session (another body, or another player's id).
   */
  const resolveExisting = async (
    id: string,
    hash: string,
    userId: string,
  ): Promise<SubmitSessionOutcome | null> => {
    const existing = await repository.findById(id);
    if (!existing) return null;
    return existing.userId === userId && existing.requestHash === hash
      ? { kind: 'duplicate', result: existing.result }
      : { kind: 'conflict' };
  };

  return {
    async submit(request, userId) {
      const hash = requestHash(request);
      const existing = await resolveExisting(request.id, hash, userId);
      if (existing) return existing;

      const now = clock.now();
      if (request.finishedAt > now + MAX_CLOCK_SKEW_MS) {
        return { kind: 'rejected', reason: 'finished-in-the-future' };
      }
      if (request.finishedAt < request.startedAt) {
        return { kind: 'rejected', reason: 'finished-before-start' };
      }
      if (request.finishedAt - request.startedAt > MAX_SESSION_DURATION_MS) {
        return { kind: 'rejected', reason: 'too-long' };
      }

      const replayed = engine.replay(request);
      if (!replayed.ok) {
        return { kind: 'rejected', reason: replayed.error.kind };
      }

      const session = replayed.value;
      const summary = engine.summarize(session);
      const graded: NewSession = {
        id: request.id,
        userId,
        config: request.config,
        seed: request.seed,
        startedAt: request.startedAt,
        finishedAt: request.finishedAt,
        endReason: request.endReason,
        answered: summary.answered,
        correct: summary.correct,
        durationMs: summary.durationMs ?? 0,
        completed: summary.completed,
        perfect: summary.perfect,
        requestHash: hash,
        recordedAt: now,
        answers: session.answers.map((answer) => ({
          countryCode: answer.countryCode,
          answer: answer.answer,
          correct: answer.correct,
          judgement: answer.judgement,
          answeredAt: answer.answeredAt,
        })),
      };

      const stored = await repository.insert(graded);
      if (stored === 'owner-missing') return { kind: 'owner-missing' };
      if (stored === 'exists') {
        // Lost a race against an identical (or conflicting) request.
        return (
          (await resolveExisting(request.id, hash, userId)) ?? {
            kind: 'conflict',
          }
        );
      }

      return {
        kind: 'created',
        result: {
          id: graded.id,
          config: graded.config,
          summary: {
            answered: summary.answered,
            correct: summary.correct,
            incorrect: summary.incorrect,
            accuracy: summary.accuracy,
            durationMs: graded.durationMs,
            endReason: request.endReason,
            completed: summary.completed,
            perfect: summary.perfect,
          },
          recordedAt: new Date(now).toISOString(),
        },
      };
    },

    async find(id, userId) {
      const stored = await repository.findById(id);
      return stored?.userId === userId ? stored.result : null;
    },
  };
}
