import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AUTH_CONFIG,
  AuthStore,
  type AuthStatus,
} from '@world-quiz/client/auth';
import { CLOCK } from '@world-quiz/client/quiz-ports';
import type { SessionHistoryPage } from '@world-quiz/shared/contracts';
import { createManualClock } from '@world-quiz/shared/util';
import { createMemoryLocalStore, LOCAL_STORE } from './local-store';
import { ProgressStore } from './progress.store';
import {
  SYNC_RETRY_DELAYS_MS,
  SYNC_SCHEDULER,
  SyncService,
} from './sync.service';
import {
  ANN,
  API,
  finishedSession,
  historyEntry,
  sessionResult,
} from '../testing';

const SESSIONS = `${API}/v1/sessions`;

function setup(status: AuthStatus = 'signed-in') {
  const reported: unknown[] = [];
  const scheduled: { delayMs: number; run: () => void }[] = [];
  const authStatus = signal<AuthStatus>(status);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AUTH_CONFIG, useValue: { apiUrl: API, googleClientId: 'g' } },
      {
        provide: AuthStore,
        useValue: { status: authStatus, user: signal(ANN) },
      },
      { provide: LOCAL_STORE, useValue: createMemoryLocalStore() },
      { provide: CLOCK, useValue: createManualClock(9_000_000) },
      {
        provide: SYNC_SCHEDULER,
        useValue: (run: () => void, delayMs: number) => {
          scheduled.push({ delayMs, run });
          return () => undefined;
        },
      },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => reported.push(error) },
      },
    ],
  });
  return {
    sync: TestBed.inject(SyncService),
    progress: TestBed.inject(ProgressStore),
    http: TestBed.inject(HttpTestingController),
    authStatus,
    reported,
    scheduled,
  };
}

const page = (
  sessions: SessionHistoryPage['sessions'],
  cursor: string | null,
  hasMore = false,
): SessionHistoryPage => ({ sessions, cursor, hasMore });

/** Lets pending promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

/** Answers the next expected request once it has been sent. */
async function answer(
  http: HttpTestingController,
  match: Parameters<HttpTestingController['expectOne']>[0],
  respond: (request: ReturnType<HttpTestingController['expectOne']>) => void,
) {
  for (let i = 0; i < 20; i++) {
    const found = http.match(match);
    if (found.length === 1 && found[0]) return respond(found[0]);
    await settle();
  }
  throw new Error('The expected request was not sent');
}

const isPost = { method: 'POST', url: SESSIONS };
const isHistory = (request: { method: string; url: string }) =>
  request.method === 'GET' && request.url === SESSIONS;

describe('SyncService', () => {
  it('sends the outbox oldest first, then pulls history page by page', async () => {
    const { sync, progress, http } = setup();
    const later = progress.recordSession(
      finishedSession([{ code: 'de', correct: true }], {
        startedAt: 3_000_000,
      }),
    );
    const earlier = progress.recordSession(
      finishedSession([{ code: 'fr', correct: true }], {
        startedAt: 1_000_000,
      }),
    );
    const sent: string[] = [];

    const done = sync.sync();
    for (let i = 0; i < 2; i++) {
      await answer(http, isPost, (request) => {
        sent.push(request.request.body.id);
        request.flush(sessionResult(request.request.body.id), {
          status: 201,
          statusText: 'Created',
        });
      });
    }
    await answer(http, isHistory, (request) => {
      expect(request.request.params.has('after')).toBe(false);
      request.flush(
        page(
          [historyEntry(crypto.randomUUID(), [{ code: 'it', correct: false }])],
          'c1',
          true,
        ),
      );
    });
    await answer(http, isHistory, (request) => {
      expect(request.request.params.get('after')).toBe('c1');
      request.flush(page([], 'c1'));
    });
    await done;

    expect(sent).toEqual([earlier.id, later.id]);
    expect(progress.pendingCount()).toBe(0);
    expect(progress.mistakeCount()).toBe(1);
    expect(await progress.historyCursor()).toBe('c1');
    expect(sync.status()).toBe('idle');
    expect(sync.lastSyncedAt()).toBe(9_000_000);
    http.verify();
  });

  it('waits offline and resends the same request later, with growing delays', async () => {
    const { sync, progress, http, scheduled } = setup();
    const played = progress.recordSession(
      finishedSession([{ code: 'fr', correct: true }]),
    );

    const first = sync.sync();
    await answer(http, isPost, (request) =>
      request.error(new ProgressEvent('error')),
    );
    await first;
    expect(sync.status()).toBe('offline');
    expect(progress.pendingCount()).toBe(1);

    const second = sync.sync();
    await answer(http, isPost, (request) =>
      request.flush(null, { status: 503, statusText: 'Unavailable' }),
    );
    await second;
    expect(scheduled.map((entry) => entry.delayMs)).toEqual(
      SYNC_RETRY_DELAYS_MS.slice(0, 2),
    );

    scheduled.at(-1)?.run();
    await answer(http, isPost, (request) => {
      expect(request.request.body).toEqual(played.request);
      request.flush(sessionResult(request.request.body.id), {
        status: 200,
        statusText: 'OK',
      });
    });
    await answer(http, isHistory, (request) => request.flush(page([], null)));
    await settle();

    expect(progress.pendingCount()).toBe(0);
    expect(sync.status()).toBe('idle');
  });

  it('marks a session the API refuses as rejected, reports it and sends the next', async () => {
    const { sync, progress, http, reported } = setup();
    progress.recordSession(
      finishedSession([{ code: 'fr', correct: false }], {
        startedAt: 1_000_000,
      }),
    );
    progress.recordSession(
      finishedSession([{ code: 'de', correct: false }], {
        startedAt: 2_000_000,
      }),
    );

    const done = sync.sync();
    await answer(http, isPost, (request) =>
      request.flush(null, { status: 422, statusText: 'Unprocessable' }),
    );
    await answer(http, isPost, (request) =>
      request.flush(sessionResult(request.request.body.id), {
        status: 201,
        statusText: 'Created',
      }),
    );
    await answer(http, isHistory, (request) => request.flush(page([], null)));
    await done;

    expect(progress.pendingCount()).toBe(0);
    expect(progress.mistakeCount()).toBe(1);
    expect(reported).toHaveLength(1);
  });

  it('does nothing unless the player is signed in', async () => {
    const { sync, progress, http } = setup('unverified');
    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));

    await sync.sync();

    http.expectNone(() => true);
    expect(progress.pendingCount()).toBe(1);
  });

  it('stops without retrying when a 401 ended the sign-in', async () => {
    const { sync, progress, http, authStatus, scheduled } = setup();
    progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));

    const done = sync.sync();
    await answer(http, isPost, (request) => {
      authStatus.set('signed-out');
      request.flush(null, { status: 401, statusText: 'Unauthorized' });
    });
    await done;

    expect(scheduled).toEqual([]);
    expect(sync.status()).toBe('idle');
  });

  it('runs once more when asked during a sync, so new results are not left behind', async () => {
    const { sync, progress, http } = setup();

    const done = sync.sync();
    let queued: Promise<void> = Promise.resolve();
    // The first run is already pulling when a session is recorded.
    await answer(http, isHistory, (request) => {
      progress.recordSession(finishedSession([{ code: 'fr', correct: true }]));
      queued = sync.sync();
      request.flush(page([], null));
    });
    await answer(http, isPost, (request) =>
      request.flush(sessionResult(request.request.body.id), {
        status: 201,
        statusText: 'Created',
      }),
    );
    await answer(http, isHistory, (request) => request.flush(page([], null)));
    await Promise.all([done, queued]);

    expect(progress.pendingCount()).toBe(0);
    http.verify();
  });

  it("gives the API's answer to a session sent now, and null when it could not be sent", async () => {
    const { sync, progress, http } = setup();
    const played = progress.recordSession(
      finishedSession([{ code: 'fr', correct: true }]),
      { challengeId: 'b0e5c0de-0000-4000-8000-000000000009' },
    );
    const verdict = {
      board: 'capitals-easy' as const,
      ranked: true,
      completionTimeMs: 1_000,
      personalRecord: true,
      rank: 1,
    };

    const answered = sync.resultOf(played.id);
    await answer(http, isPost, (request) => {
      expect(request.request.body.challengeId).toBe(
        'b0e5c0de-0000-4000-8000-000000000009',
      );
      request.flush(sessionResult(played.id, { challenge: verdict }), {
        status: 201,
        statusText: 'Created',
      });
    });
    await answer(http, isHistory, (request) => request.flush(page([], null)));

    expect((await answered)?.challenge).toEqual(verdict);

    const offline = progress.recordSession(
      finishedSession([{ code: 'de', correct: true }]),
    );
    const unsent = sync.resultOf(offline.id);
    await answer(http, isPost, (request) =>
      request.error(new ProgressEvent('error')),
    );
    expect(await unsent).toBeNull();
  });
});
