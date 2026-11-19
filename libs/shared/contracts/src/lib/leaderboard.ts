import {
  LEADERBOARD_BOARDS,
  type LeaderboardBoardId,
} from '@world-quiz/quiz/domain';
import { z } from 'zod';

/**
 * Every public board (docs/domain/leaderboard.md): category × difficulty ×
 * region × ranked mode, 56 of them.
 *
 * Taken from the domain rather than written out: a list of 56 ids kept by hand
 * would be a second source of truth, and the ids are generated from the four
 * choices the quiz setup asks for anyway.
 */
export const LEADERBOARD_BOARD_IDS: readonly LeaderboardBoardId[] =
  LEADERBOARD_BOARDS.map((board) => board.id);

export const leaderboardBoardIdSchema = z.enum(LEADERBOARD_BOARD_IDS);

/**
 * What a run achieved on its board, as part of the session's result.
 *
 * `score` is the board's metric — milliseconds on a quick-round board, correct
 * answers on a Time attack board (`leaderboardMetricOf`) — and `timeMs` is the
 * run's own length, which is the tie-break where the score is a count.
 */
export const rankedOutcomeSchema = z.object({
  board: leaderboardBoardIdSchema,
  score: z.int().nonnegative(),
  timeMs: z.int().nonnegative(),
  /** The player's rank on the board now, counting this run. */
  rank: z.int().positive(),
  /** How many players have a ranked run on the board. */
  players: z.int().positive(),
  /** The run beat the player's own previous best on this board. */
  personalRecord: z.boolean(),
});
export type RankedOutcome = z.infer<typeof rankedOutcomeSchema>;

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
  /** The board's metric: milliseconds, or correct answers. */
  score: z.int().nonnegative(),
  /** The run's own length, shown beside a score that counts answers. */
  timeMs: z.int().nonnegative(),
  recordedAt: z.iso.datetime(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;

export const leaderboardSchema = z.object({
  board: leaderboardBoardIdSchema,
  /** Players with a ranked run on this board. */
  players: z.int().nonnegative(),
  /** The best players first, one entry each. */
  entries: z.array(leaderboardEntrySchema),
});
export type Leaderboard = z.infer<typeof leaderboardSchema>;

/**
 * `GET /v1/me/records`: the player's best ranked run per board, with the rank
 * it holds. This is also the player's own row on a board they are not high
 * enough to appear in.
 */
export const myRecordSchema = z.object({
  board: leaderboardBoardIdSchema,
  /** The player's own public name, so their row reads like every other. */
  nickname: z.string(),
  rank: z.int().positive(),
  players: z.int().positive(),
  score: z.int().nonnegative(),
  timeMs: z.int().nonnegative(),
  recordedAt: z.iso.datetime(),
});
export type MyRecord = z.infer<typeof myRecordSchema>;

export const myRecordsSchema = z.object({
  records: z.array(myRecordSchema),
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
