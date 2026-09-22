import { InjectionToken } from '@angular/core';
import type { SubmitSessionRequest, User } from '@world-quiz/shared/contracts';
import type { ProgressEvent } from '@world-quiz/quiz/domain';

/**
 * Where a session's result stands with the account.
 *
 * - `pending`: played on this device, waiting in the outbox;
 * - `synced`: recorded by the API (sent from here, or pulled from history);
 * - `rejected`: the API refused it (it could not verify the session). It is
 *   kept for diagnosis but no longer counts towards progress, because the
 *   account — and every other device — never had it.
 */
export type SyncState = 'pending' | 'synced' | 'rejected';

/** One finished session as this device keeps it. */
export interface LocalSession {
  readonly id: string;
  readonly sync: SyncState;
  readonly finishedAt: number;
  /** The answers as progress events, in the order they were given. */
  readonly events: readonly ProgressEvent[];
  /** What to send to the API; only sessions played on this device have it. */
  readonly request?: SubmitSessionRequest;
}

/**
 * Local persistence of progress (ADR-006).
 *
 * The data on a device belongs to exactly one account, its `owner`. Signing
 * in with another account, or signing out, clears it first: a shared device
 * never mixes or shows another player's results.
 */
export interface LocalStore {
  readOwner(): Promise<User | null>;
  /** Replaces the owner; the caller clears the data first when it changes. */
  writeOwner(owner: User): Promise<void>;
  readSessions(): Promise<LocalSession[]>;
  /** Inserts or replaces sessions by id. */
  putSessions(sessions: readonly LocalSession[]): Promise<void>;
  /** The history cursor of the last pulled page (`GET /v1/sessions`). */
  readCursor(): Promise<string | null>;
  /** Stores pulled sessions and the cursor after them atomically. */
  savePulledPage(
    sessions: readonly LocalSession[],
    cursor: string | null,
  ): Promise<void>;
  /** Deletes everything: owner, sessions, cursor. */
  clear(): Promise<void>;
}

export const LOCAL_STORE = new InjectionToken<LocalStore>('LOCAL_STORE');

/** A `LocalStore` in memory: tests, and quizzes served without the shell. */
export function createMemoryLocalStore(): LocalStore {
  let owner: User | null = null;
  let cursor: string | null = null;
  const sessions = new Map<string, LocalSession>();

  return {
    readOwner: async () => owner,
    writeOwner: async (next) => {
      owner = next;
    },
    readSessions: async () => [...sessions.values()],
    putSessions: async (list) => {
      for (const session of list) sessions.set(session.id, session);
    },
    readCursor: async () => cursor,
    savePulledPage: async (list, next) => {
      for (const session of list) sessions.set(session.id, session);
      cursor = next;
    },
    clear: async () => {
      owner = null;
      cursor = null;
      sessions.clear();
    },
  };
}
