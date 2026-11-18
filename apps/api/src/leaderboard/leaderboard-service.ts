import type {
  Leaderboard,
  MyRecords,
  RankedOutcome,
} from '@world-quiz/shared/contracts';
import type { LeaderboardBoardId } from '@world-quiz/quiz/domain';
import { defaultNickname } from '../auth/nickname';
import type {
  LeaderboardRepository,
  RankedPlace,
} from './leaderboard-repository';
import type { StoredRankedRun } from './ranked-run-rules';

export interface LeaderboardService {
  /** `among`, when given, ranks the board over those players only. */
  board(
    board: LeaderboardBoardId,
    limit: number,
    among?: readonly string[],
  ): Promise<Leaderboard>;
  records(userId: string): Promise<MyRecords>;
  /**
   * A recorded run's place as it stands now: the rank is the player's own
   * standing on the board, which a later, better run of theirs moves up;
   * `personalRecord` says whether this run was the one that did it.
   *
   * `null` when the board holds no run of this player, which can only mean
   * the run was removed between recording it and reading it back.
   */
  outcome(userId: string, run: StoredRankedRun): Promise<RankedOutcome | null>;
}

export interface LeaderboardServiceDependencies {
  readonly repository: LeaderboardRepository;
}

export function createLeaderboardService({
  repository,
}: LeaderboardServiceDependencies): LeaderboardService {
  /** The public name: never the provider's, until the player picks one. */
  const nameOf = (place: RankedPlace) =>
    place.nickname ?? defaultNickname(place.userId);

  return {
    async board(board, limit, among) {
      const { players, runs } = await repository.board(board, limit, among);
      return {
        board,
        players,
        entries: runs.map((run) => ({
          rank: run.rank,
          nickname: nameOf(run),
          score: run.score,
          timeMs: run.timeMs,
          recordedAt: new Date(run.recordedAt).toISOString(),
        })),
      };
    },

    async records(userId) {
      const records = await repository.playerRecords(userId);
      return {
        records: records.map((record) => ({
          board: record.board,
          nickname: nameOf(record),
          rank: record.rank,
          players: record.players,
          score: record.score,
          timeMs: record.timeMs,
          recordedAt: new Date(record.recordedAt).toISOString(),
        })),
      };
    },

    async outcome(userId, run) {
      const place = await repository.playerPlace(userId, run.board);
      if (!place) return null;
      return {
        board: run.board,
        score: run.score,
        timeMs: run.timeMs,
        rank: place.rank,
        players: place.players,
        personalRecord: run.personalRecord,
      };
    },
  };
}
