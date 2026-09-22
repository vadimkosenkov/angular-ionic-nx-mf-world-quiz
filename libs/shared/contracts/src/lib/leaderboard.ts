import type {
  ChallengeIneligibility,
  LeaderboardBoardId,
} from '@world-quiz/quiz/domain';
import { z } from 'zod';
import { uuidSchema } from './common';

/**
 * The four boards (docs/domain/leaderboard.md). Written out because `z.enum`
 * needs a literal tuple; the check below fails to compile if the domain's
 * boards and this list ever differ.
 */
export const LEADERBOARD_BOARD_IDS = [
  'capitals-easy',
  'capitals-hard',
  'flags-easy',
  'flags-hard',
] as const satisfies readonly LeaderboardBoardId[];

type MissingBoards = Exclude<
  LeaderboardBoardId,
  (typeof LEADERBOARD_BOARD_IDS)[number]
>;
const everyBoardListed: MissingBoards extends never ? true : never = true;
void everyBoardListed;

export const leaderboardBoardIdSchema = z.enum(LEADERBOARD_BOARD_IDS);

/** `POST /v1/challenges`: start a perfect-run challenge on a board. */
export const startChallengeRequestSchema = z.strictObject({
  board: leaderboardBoardIdSchema,
});
export type StartChallengeRequest = z.infer<typeof startChallengeRequestSchema>;

/**
 * A challenge issued by the server. The client plays it with exactly this
 * `seed` and sends the session with `challengeId`; it can be played once,
 * until `expiresAt`.
 */
export const challengeSchema = z.object({
  id: uuidSchema,
  board: leaderboardBoardIdSchema,
  seed: z.string(),
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type Challenge = z.infer<typeof challengeSchema>;

/**
 * Why a challenge run is not ranked: the domain's eligibility rules, and the
 * server's timing checks:
 * - `expired`: sent after the challenge's lifetime;
 * - `late`: the run's time and the server's window (issued → received)
 *   differ by more than the tolerance, e.g. the result was sent later;
 * - `implausible-time`: the run claims more time than has passed.
 */
export const CHALLENGE_UNRANKED_REASONS = [
  'not-finished',
  'incomplete',
  'has-incorrect-answers',
  'invalid-question-set',
  'expired',
  'late',
  'implausible-time',
] as const satisfies readonly (
  | Exclude<ChallengeIneligibility, 'not-a-challenge'>
  | 'expired'
  | 'late'
  | 'implausible-time'
)[];
export type ChallengeUnrankedReason =
  (typeof CHALLENGE_UNRANKED_REASONS)[number];

/** What a recorded challenge run achieved, in the session result. */
export const challengeOutcomeSchema = z.object({
  board: leaderboardBoardIdSchema,
  ranked: z.boolean(),
  /** Why it is not ranked; absent when it is. */
  reason: z.enum(CHALLENGE_UNRANKED_REASONS).optional(),
  /** The run's time (first question to last answer), when it has one. */
  completionTimeMs: z.int().nonnegative().nullable(),
  /** The run beat the player's previous best on this board. */
  personalRecord: z.boolean(),
  /** The player's current rank on the board, if they have a ranked run. */
  rank: z.int().positive().nullable(),
});
export type ChallengeOutcome = z.infer<typeof challengeOutcomeSchema>;

export const MAX_LEADERBOARD_SIZE = 100;
export const DEFAULT_LEADERBOARD_SIZE = 50;

/** `GET /v1/leaderboards/:board?limit=`. */
export const leaderboardQuerySchema = z.strictObject({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_LEADERBOARD_SIZE)
    .default(DEFAULT_LEADERBOARD_SIZE),
});

/**
 * One player's best run on a board. Public: only the nickname identifies the
 * player — never an id, name or e-mail from the provider.
 */
export const leaderboardEntrySchema = z.object({
  rank: z.int().positive(),
  nickname: z.string(),
  completionTimeMs: z.int().nonnegative(),
  recordedAt: z.iso.datetime(),
});

export const leaderboardSchema = z.object({
  board: leaderboardBoardIdSchema,
  /** Players with a ranked run on this board. */
  players: z.int().nonnegative(),
  /** The fastest players first, one entry each. */
  entries: z.array(leaderboardEntrySchema),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

/** `GET /v1/me/records`: the player's best ranked run per board. */
export const myRecordsSchema = z.object({
  records: z.array(
    z.object({
      board: leaderboardBoardIdSchema,
      rank: z.int().positive(),
      players: z.int().positive(),
      completionTimeMs: z.int().nonnegative(),
      recordedAt: z.iso.datetime(),
    }),
  ),
});
export type MyRecords = z.infer<typeof myRecordsSchema>;

/**
 * A public name: 3 to 24 letters, digits, spaces, `_`, `-` or `.`, starting
 * and ending with a letter or digit, no double spaces. Any script is allowed.
 */
export const nicknameSchema = z
  .string()
  .trim()
  .normalize('NFC')
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N}](?:[\p{L}\p{N}_.-]| (?! ))*[\p{L}\p{N}]$/u);

/** `PATCH /v1/me`: what the player may change about their account. */
export const updateProfileRequestSchema = z.strictObject({
  nickname: nicknameSchema,
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
