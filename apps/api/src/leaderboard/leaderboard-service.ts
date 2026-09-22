import { randomBytes, randomUUID } from 'node:crypto';
import type {
  Challenge,
  ChallengeOutcome,
  ChallengeUnrankedReason,
  Leaderboard,
  MyRecords,
} from '@world-quiz/shared/contracts';
import type { LeaderboardBoardId } from '@world-quiz/quiz/domain';
import type { Clock } from '@world-quiz/shared/util';
import { defaultNickname } from '../auth/nickname';
import type { ChallengeVerdict } from '../sessions/session-repository';
import { CHALLENGE_LIFETIME_MS } from './challenge-rules';
import type { LeaderboardRepository } from './leaderboard-repository';

export interface LeaderboardService {
  /** Issues a challenge with a fresh seed for the player. */
  startChallenge(userId: string, board: LeaderboardBoardId): Promise<Challenge>;
  board(board: LeaderboardBoardId, limit: number): Promise<Leaderboard>;
  records(userId: string): Promise<MyRecords>;
  /** A recorded run's verdict as the client sees it, with the current rank. */
  outcome(userId: string, verdict: ChallengeVerdict): Promise<ChallengeOutcome>;
}

export interface LeaderboardServiceDependencies {
  readonly repository: LeaderboardRepository;
  readonly clock: Clock;
}

export function createLeaderboardService({
  repository,
  clock,
}: LeaderboardServiceDependencies): LeaderboardService {
  return {
    async startChallenge(userId, board) {
      const issuedAt = clock.now();
      // Unplayed challenges that can no longer be played are of no use.
      await repository.deleteUnplayedChallenges(
        userId,
        issuedAt - CHALLENGE_LIFETIME_MS,
      );
      const challenge = {
        id: randomUUID(),
        userId,
        board,
        // 128 random bits: the question order and choices cannot be known
        // before the challenge is issued.
        seed: randomBytes(16).toString('base64url'),
        issuedAt,
      };
      await repository.issueChallenge(challenge);
      return {
        id: challenge.id,
        board,
        seed: challenge.seed,
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(issuedAt + CHALLENGE_LIFETIME_MS).toISOString(),
      };
    },

    async board(board, limit) {
      const { players, runs } = await repository.board(board, limit);
      return {
        board,
        players,
        entries: runs.map((run) => ({
          rank: run.rank,
          nickname: run.nickname ?? defaultNickname(run.userId),
          completionTimeMs: run.completionMs,
          recordedAt: new Date(run.recordedAt).toISOString(),
        })),
      };
    },

    async records(userId) {
      const records = await repository.playerRecords(userId);
      return {
        records: records.map((record) => ({
          board: record.board,
          rank: record.rank,
          players: record.players,
          completionTimeMs: record.completionMs,
          recordedAt: new Date(record.recordedAt).toISOString(),
        })),
      };
    },

    async outcome(userId, verdict) {
      const ranked = verdict.outcome === 'ranked';
      const current = await repository.playerRank(userId, verdict.board);
      return {
        board: verdict.board,
        ranked,
        ...(ranked
          ? {}
          : { reason: verdict.outcome as ChallengeUnrankedReason }),
        completionTimeMs: verdict.completionMs,
        personalRecord: verdict.personalRecord,
        rank: current?.rank ?? null,
      };
    },
  };
}
