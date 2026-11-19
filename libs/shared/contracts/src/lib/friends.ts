import { ACHIEVEMENTS } from '@world-quiz/quiz/domain';
import type { AchievementId } from '@world-quiz/quiz/domain';
import { z } from 'zod';
import { uuidSchema } from './common';
import { myRecordSchema } from './leaderboard';

/**
 * Friends: how two players become one, and what they then see of each other
 * (docs/decisions/0015-friends.md).
 *
 * There is no directory and no search: a player is found only through the
 * invite code they handed over themselves, so nobody can be looked up by
 * name. What a friend sees is what the public boards already show — a
 * nickname, the best runs — plus the achievements, which are learning
 * progress and not a history of play.
 */

/**
 * The alphabet an invite code is written in: Crockford's base32, which
 * leaves out `I`, `L`, `O` and `U` so a code read off a screen cannot be
 * mistyped as a different, valid one.
 */
export const INVITE_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const INVITE_CODE_LENGTH = 8;

/**
 * What a player typed, as the code they meant.
 *
 * Spaces and dashes are how people break a code up when they copy it; `I`
 * and `L` are how they write `1`, and `O` is how they write `0` (Crockford's
 * own rule). Case never matters.
 */
export function normaliseInviteCode(raw: string): string {
  return raw
    .replace(/[\s-]/g, '')
    .toUpperCase()
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
}

export const inviteCodeSchema = z
  .string()
  .max(32)
  .transform(normaliseInviteCode)
  .refine(
    (code) =>
      code.length === INVITE_CODE_LENGTH &&
      [...code].every((character) => INVITE_CODE_ALPHABET.includes(character)),
    { message: `An invite code is ${INVITE_CODE_LENGTH} characters long.` },
  );

/** `POST /v1/friends/requests`: ask the owner of this code to be friends. */
export const friendRequestBodySchema = z.strictObject({
  code: inviteCodeSchema,
});
export type FriendRequestBody = z.infer<typeof friendRequestBodySchema>;

/** Another player, as everyone else is allowed to see them. */
export const friendSchema = z.object({
  id: uuidSchema,
  /** The public name, exactly as the boards show it. */
  nickname: z.string(),
  /** When the friendship was agreed, or when the request was sent. */
  since: z.iso.datetime(),
});
export type Friend = z.infer<typeof friendSchema>;

/**
 * `GET /v1/friends`: everyone this player is connected to, in the three
 * states a connection can be in. A request is one row until it is accepted,
 * so nobody appears twice.
 */
export const friendsSchema = z.object({
  friends: z.array(friendSchema),
  /** Requests waiting for this player's answer. */
  incoming: z.array(friendSchema),
  /** Requests this player sent and nobody has answered yet. */
  outgoing: z.array(friendSchema),
});
export type Friends = z.infer<typeof friendsSchema>;

/**
 * What asking (or accepting) left behind: `accepted` when the other player
 * had already asked, so the two requests met and the friendship is done.
 */
export const friendRequestResultSchema = z.object({
  status: z.enum(['requested', 'accepted']),
  friend: friendSchema,
});
export type FriendRequestResult = z.infer<typeof friendRequestResultSchema>;

/**
 * The achievement ids, taken from the domain rather than written out: they
 * are generated from the categories and the regions, and a second list kept
 * by hand would be a second source of truth.
 */
export const ACHIEVEMENT_IDS: readonly AchievementId[] = ACHIEVEMENTS.map(
  (achievement) => achievement.id,
);
export const achievementIdSchema = z.enum(ACHIEVEMENT_IDS);

/**
 * One achievement of a friend, as the achievements screen draws it: how far
 * they are, out of how many countries.
 */
export const friendAchievementSchema = z.object({
  id: achievementIdSchema,
  status: z.enum(['locked', 'in-progress', 'unlocked']),
  mastered: z.int().nonnegative(),
  total: z.int().nonnegative(),
});
export type FriendAchievement = z.infer<typeof friendAchievementSchema>;

/**
 * `GET /v1/friends/:id`: a friend's page — their best run per board, and
 * what they have learned. Only a friend may read it; to everyone else the
 * player does not exist.
 */
export const friendProfileSchema = z.object({
  friend: friendSchema,
  /** The same rows as `/v1/me/records`, for that player. */
  records: z.array(myRecordSchema),
  achievements: z.array(friendAchievementSchema),
});
export type FriendProfile = z.infer<typeof friendProfileSchema>;
