import { HttpErrorResponse } from '@angular/common/http';
import {
  ErrorHandler,
  inject,
  Injectable,
  InjectionToken,
  signal,
} from '@angular/core';
import { AuthStore } from '@world-quiz/client/auth';
import { CLOCK } from '@world-quiz/client/quiz-ports';
import { ProgressStore } from './progress.store';
import { pulledSession } from './session-mapping';
import { SyncApi } from './sync-api';

/**
 * - `idle`: nothing running; the last sync (if any) succeeded;
 * - `syncing`: sending the outbox or pulling history;
 * - `offline`: the API could not be reached or was busy; a retry is scheduled.
 */
export type SyncStatus = 'idle' | 'syncing' | 'offline';

/** Waits between retries after a failed sync; the last one repeats. */
export const SYNC_RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000] as const;

/** Runs `task` after `delayMs`; returns a function that cancels it. */
export type SyncScheduler = (task: () => void, delayMs: number) => () => void;

export const SYNC_SCHEDULER = new InjectionToken<SyncScheduler>(
  'SYNC_SCHEDULER',
  {
    providedIn: 'root',
    factory: () => (task, delayMs) => {
      const handle = setTimeout(task, delayMs);
      return () => clearTimeout(handle);
    },
  },
);

/**
 * Synchronises the device with the account: sends the outbox, then pulls the
 * sessions recorded elsewhere.
 *
 * - **Sending is idempotent.** Each session has the id it was created with,
 *   so a request that timed out is simply sent again (the API answers 200
 *   with the stored result). Sessions go oldest first, one at a time.
 * - **The API decides.** 422 (the session cannot be verified), 409 (the id
 *   is taken) and 400 (the request breaks the contract) are final: the
 *   session is marked `rejected` and reported, not retried forever.
 * - **Failures without an answer wait.** Offline, 5xx or 429 stop this run
 *   and schedule another with growing delays. A 401 after which the player
 *   is signed out ends the sync (sign-in again restarts it); a 401 while
 *   still signed in (the token could not be renewed offline) waits too.
 * - One run at a time: a request while running queues exactly one more run.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly api = inject(SyncApi);
  private readonly auth = inject(AuthStore);
  private readonly progress = inject(ProgressStore);
  private readonly clock = inject(CLOCK);
  private readonly schedule = inject(SYNC_SCHEDULER);
  private readonly errorHandler = inject(ErrorHandler);

  private readonly statusState = signal<SyncStatus>('idle');
  private readonly lastSyncedAtState = signal<number | null>(null);
  private running: Promise<void> | null = null;
  private runAgain = false;
  private failures = 0;
  private cancelRetry: (() => void) | null = null;

  readonly status = this.statusState.asReadonly();
  /** When the device last matched the account (epoch milliseconds). */
  readonly lastSyncedAt = this.lastSyncedAtState.asReadonly();

  /** Syncs now; resolves when this sync (and any queued one) is over. */
  sync(): Promise<void> {
    if (this.running) {
      this.runAgain = true;
      return this.running;
    }
    this.running = this.loop().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async loop(): Promise<void> {
    do {
      this.runAgain = false;
      await this.runOnce();
    } while (this.runAgain);
  }

  private async runOnce(): Promise<void> {
    const user = this.auth.user();
    if (this.auth.status() !== 'signed-in' || !user) return;

    this.cancelRetry?.();
    this.cancelRetry = null;
    this.statusState.set('syncing');
    try {
      await this.progress.claim(user);
      await this.push();
      await this.pull();
      this.failures = 0;
      this.lastSyncedAtState.set(this.clock.now());
      this.statusState.set('idle');
    } catch (error) {
      this.handleFailure(error);
    }
  }

  private async push(): Promise<void> {
    for (const session of this.progress.pending()) {
      if (!session.request) continue;
      try {
        await this.api.submit(session.request);
        this.progress.markSynced([session.id]);
      } catch (error) {
        if (!isFinalRefusal(error)) throw error;
        this.progress.markRejected([session.id]);
        this.errorHandler.handleError(error);
      }
    }
  }

  private async pull(): Promise<void> {
    let cursor = await this.progress.historyCursor();
    for (;;) {
      const page = await this.api.history(cursor);
      await this.progress.addPulledPage(
        page.sessions.map(pulledSession),
        page.cursor,
      );
      cursor = page.cursor;
      if (!page.hasMore) return;
    }
  }

  private handleFailure(error: unknown): void {
    const unauthorized =
      error instanceof HttpErrorResponse && error.status === 401;
    if (unauthorized && this.auth.status() !== 'signed-in') {
      this.statusState.set('idle');
      return;
    }
    if (!unauthorized && !isTransient(error)) {
      this.errorHandler.handleError(error);
    }
    this.statusState.set('offline');
    const delay =
      SYNC_RETRY_DELAYS_MS[this.failures] ?? SYNC_RETRY_DELAYS_MS.at(-1) ?? 0;
    this.failures += 1;
    this.cancelRetry = this.schedule(() => void this.sync(), delay);
  }
}

/** The API refused this session for good. */
function isFinalRefusal(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 400 || error.status === 409 || error.status === 422)
  );
}

/** No answer, or a server that may answer later. */
function isTransient(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 0 || error.status === 429 || error.status >= 500)
  );
}
