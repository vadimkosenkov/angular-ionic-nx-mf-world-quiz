import type {
  SessionHistoryPage,
  SessionResult,
  SubmitSessionRequest,
} from '@world-quiz/shared/contracts';
import {
  CHALLENGE_MODE,
  leaderboardBoardFor,
  type QuizEngine,
  type ReplayError,
} from '@world-quiz/quiz/domain';
import type { Clock } from '@world-quiz/shared/util';
import { judgeChallengeRun } from '../leaderboard/challenge-rules';
import type {
  LeaderboardRepository,
  StoredChallenge,
} from '../leaderboard/leaderboard-repository';
import type { LeaderboardService } from '../leaderboard/leaderboard-service';
import { encodeHistoryCursor, type HistoryPosition } from './history-cursor';
import { requestHash } from './request-hash';
import type {
  NewSession,
  SessionRepository,
  StoredSession,
} from './session-repository';

/** How far a client clock may run ahead of the server's. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
/** No session is played for longer than a day; older data is not a session. */
export const MAX_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
/**
 * How long a recorded session waits before it appears in the history.
 *
 * `recordedAt` is taken before the session is written, so a session that is
 * still being committed can have an earlier `recordedAt` than one a client
 * has already paged past. History only lists sessions older than this
 * window; by then every earlier insert has committed, and a client that keeps
 * its cursor misses nothing. The player's own device does not wait: it has
 * its sessions already.
 */
export const HISTORY_SETTLE_MS = 5_000;

/** Why a well-formed session was refused. */
export type SessionRejection =
  | ReplayError['kind']
  | 'finished-in-the-future'
  | 'finished-before-start'
  | 'too-long'
  /** A challenge session without `challengeId`. */
  | 'challenge-missing'
  /** `challengeId` on a training session. */
  | 'not-a-challenge'
  /** No such challenge for this player. */
  | 'unknown-challenge'
  /** The session's board or seed is not the challenge's. */
  | 'challenge-mismatch'
  /** Another session already played this challenge. */
  | 'challenge-used';

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
  /** A page of the player's history, oldest recorded first. */
  history(
    userId: string,
    page: {
      readonly after: HistoryPosition | null;
      /** The cursor `after` came from, returned again for an empty page. */
      readonly afterCursor: string | null;
      readonly limit: number;
    },
  ): Promise<SessionHistoryPage>;
}

export interface SessionServiceDependencies {
  readonly repository: SessionRepository;
  readonly engine: QuizEngine;
  readonly clock: Clock;
  readonly challenges: LeaderboardRepository;
  readonly leaderboard: LeaderboardService;
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
  challenges,
  leaderboard,
}: SessionServiceDependencies): SessionService {
  /** The stored result, with the challenge outcome as it stands now. */
  const withOutcome = async (stored: StoredSession) =>
    stored.challenge
      ? {
          ...stored.result,
          challenge: await leaderboard.outcome(stored.userId, stored.challenge),
        }
      : stored.result;

  /** The challenge a session plays, if the session may play it. */
  const challengeFor = async (
    request: SubmitSessionRequest,
    userId: string,
  ): Promise<
    | { readonly ok: true; readonly challenge: StoredChallenge | null }
    | { readonly ok: false; readonly reason: SessionRejection }
  > => {
    const isChallenge = request.config.mode === CHALLENGE_MODE;
    if (!isChallenge) {
      return request.challengeId
        ? { ok: false, reason: 'not-a-challenge' }
        : { ok: true, challenge: null };
    }
    if (!request.challengeId) return { ok: false, reason: 'challenge-missing' };

    const challenge = await challenges.findChallenge(request.challengeId);
    if (!challenge || challenge.userId !== userId) {
      return { ok: false, reason: 'unknown-challenge' };
    }
    if (challenge.sessionId) return { ok: false, reason: 'challenge-used' };
    const board = leaderboardBoardFor(
      request.config.category,
      request.config.difficulty,
    );
    if (board.id !== challenge.board || request.seed !== challenge.seed) {
      return { ok: false, reason: 'challenge-mismatch' };
    }
    return { ok: true, challenge };
  };

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
      ? { kind: 'duplicate', result: await withOutcome(existing) }
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

      const played = await challengeFor(request, userId);
      if (!played.ok) return { kind: 'rejected', reason: played.reason };

      const replayed = engine.replay(request);
      if (!replayed.ok) {
        return { kind: 'rejected', reason: replayed.error.kind };
      }

      const session = replayed.value;
      const summary = engine.summarize(session);

      let challenge: NewSession['challenge'];
      if (played.challenge) {
        const previousBest = await challenges.playerRank(
          userId,
          played.challenge.board,
        );
        challenge = {
          id: played.challenge.id,
          board: played.challenge.board,
          ...judgeChallengeRun({
            session,
            summary,
            dataset: engine.dataset,
            issuedAt: played.challenge.issuedAt,
            receivedAt: now,
            previousBestMs: previousBest?.completionMs ?? null,
          }),
        };
      }
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
        ...(challenge ? { challenge } : {}),
      };

      const stored = await repository.insert(graded);
      if (stored === 'owner-missing') return { kind: 'owner-missing' };
      if (stored === 'challenge-used') {
        // Another session played the challenge meanwhile, unless it was
        // this very session sent twice at once.
        return (
          (await resolveExisting(request.id, hash, userId)) ?? {
            kind: 'rejected',
            reason: 'challenge-used',
          }
        );
      }
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
          ...(challenge
            ? { challenge: await leaderboard.outcome(userId, challenge) }
            : {}),
        },
      };
    },

    async find(id, userId) {
      const stored = await repository.findById(id);
      return stored?.userId === userId ? withOutcome(stored) : null;
    },

    async history(userId, { after, afterCursor, limit }) {
      // One row more than asked tells whether another page follows.
      const rows = await repository.history({
        userId,
        after,
        recordedUntil: clock.now() - HISTORY_SETTLE_MS,
        limit: limit + 1,
      });
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        sessions: page.map((row) => row.entry),
        cursor: last ? encodeHistoryCursor(last.position) : afterCursor,
        hasMore: rows.length > limit,
      };
    },
  };
}
