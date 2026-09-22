import { uuidSchema } from '@world-quiz/shared/contracts';

/**
 * A position in a player's history: after the session recorded at
 * `recordedAt` with this `id`. Sessions are ordered by `(recordedAt, id)`, so
 * two sessions recorded in the same millisecond are neither skipped nor
 * returned twice across a page boundary.
 */
export interface HistoryPosition {
  readonly recordedAt: number;
  readonly id: string;
}

/**
 * Cursors are opaque to clients (base64url), so the ordering can change
 * later without changing the contract.
 */
export function encodeHistoryCursor({ recordedAt, id }: HistoryPosition) {
  return Buffer.from(`${recordedAt}:${id}`, 'utf8').toString('base64url');
}

/** The position in a cursor, or `null` when it is not one of ours. */
export function decodeHistoryCursor(cursor: string): HistoryPosition | null {
  const match = /^(\d{1,15}):(.+)$/.exec(
    Buffer.from(cursor, 'base64url').toString('utf8'),
  );
  const id = uuidSchema.safeParse(match?.[2]);
  if (!match || !id.success) return null;
  return { recordedAt: Number(match[1]), id: id.data };
}
