import type { CountryDataset } from '@world-quiz/quiz/domain';
import { evaluateAchievements, rebuildProgress } from '@world-quiz/quiz/domain';
import type {
  Friend,
  FriendProfile,
  FriendRequestResult,
  Friends,
} from '@world-quiz/shared/contracts';
import type { Clock } from '@world-quiz/shared/util';
import { err, ok, type Result } from '@world-quiz/shared/util';
import { defaultNickname } from '../auth/nickname';
import type { LeaderboardService } from '../leaderboard/leaderboard-service';
import type { FriendRepository, FriendRow } from './friend-repository';
import type { ProgressRepository } from './progress-repository';

/** Why asking someone to be friends could not be done. */
export type FriendRequestError =
  /** No player holds this invite code. */
  | 'unknown-code'
  /** The player's own code: there is nobody on the other side. */
  | 'self';

export interface FriendService {
  friends(userId: string): Promise<Friends>;
  /** Asks the owner of an invite code to be friends. */
  request(
    userId: string,
    code: string,
  ): Promise<Result<FriendRequestResult, FriendRequestError>>;
  /** Accepts a waiting request; `null` when there is none from that player. */
  accept(userId: string, otherId: string): Promise<FriendRequestResult | null>;
  /** Ends the connection, whether it was a friendship or a request. */
  remove(userId: string, otherId: string): Promise<void>;
  /** A friend's page; `null` to everyone who is not their friend. */
  profile(userId: string, otherId: string): Promise<FriendProfile | null>;
  /** The player and their friends: who the shared board is ranked over. */
  boardMembers(userId: string): Promise<string[]>;
}

export interface FriendServiceDependencies {
  readonly repository: FriendRepository;
  readonly progress: ProgressRepository;
  readonly leaderboard: LeaderboardService;
  /** The countries a friend's achievements are measured against. */
  readonly dataset: CountryDataset;
  readonly clock: Clock;
}

export function createFriendService({
  repository,
  progress,
  leaderboard,
  dataset,
  clock,
}: FriendServiceDependencies): FriendService {
  /** The public name: never the provider's, until the player picks one. */
  const toFriend = (row: FriendRow): Friend => ({
    id: row.id,
    nickname: row.nickname ?? defaultNickname(row.id),
    since: new Date(row.since).toISOString(),
  });

  return {
    async friends(userId) {
      const lists = await repository.lists(userId);
      return {
        friends: lists.friends.map(toFriend),
        incoming: lists.incoming.map(toFriend),
        outgoing: lists.outgoing.map(toFriend),
      };
    },

    async request(userId, code) {
      const owner = await repository.findByInviteCode(code);
      if (!owner) return err('unknown-code');
      if (owner.id === userId) return err('self');
      const status = await repository.request(userId, owner.id, clock.now());
      return ok({ status, friend: toFriend(owner) });
    },

    async accept(userId, otherId) {
      const accepted = await repository.accept(userId, otherId, clock.now());
      if (!accepted) return null;
      const friend = await repository.friend(userId, otherId);
      return friend ? { status: 'accepted', friend: toFriend(friend) } : null;
    },

    async remove(userId, otherId) {
      await repository.remove(userId, otherId);
    },

    async profile(userId, otherId) {
      const friend = await repository.friend(userId, otherId);
      if (!friend) return null;
      // The friend's own records, as the player sees their own: the same
      // rows, with that player's nickname on them.
      const [{ records }, events] = await Promise.all([
        leaderboard.records(otherId),
        progress.events(otherId),
      ]);
      const achievements = evaluateAchievements(
        dataset,
        rebuildProgress(events),
      ).map((entry) => ({
        id: entry.achievement.id,
        status: entry.status,
        mastered: entry.mastered,
        total: entry.total,
      }));
      return { friend: toFriend(friend), records, achievements };
    },

    async boardMembers(userId) {
      // A board of friends is a board the player stands on too, or their
      // own best run would be missing from the ranking they are reading.
      return [userId, ...(await repository.friendIds(userId))];
    },
  };
}
