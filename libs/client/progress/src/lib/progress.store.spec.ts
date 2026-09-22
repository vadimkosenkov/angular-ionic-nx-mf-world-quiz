import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createMemoryLocalStore,
  LOCAL_STORE,
  type LocalStore,
} from './local-store';
import { ProgressStore } from './progress.store';
import { pulledSession } from './session-mapping';
import { ANN, BOB, finishedSession, historyEntry } from '../testing';

function setup(local: LocalStore = createMemoryLocalStore()) {
  const reported: unknown[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: LOCAL_STORE, useValue: local },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => reported.push(error) },
      },
    ],
  });
  return { store: TestBed.inject(ProgressStore), local, reported };
}

/** Three correct Easy answers master a country. */
const masterAll = (codes: readonly string[]) =>
  [0, 1, 2].map((round) =>
    finishedSession(
      codes.map((code) => ({ code, correct: true })),
      { category: 'flags', startedAt: 1_000_000 + round * 100_000 },
    ),
  );

describe('ProgressStore', () => {
  it('derives counts from the real dataset and starts at zero', () => {
    const { store } = setup();

    expect(store.countryCount).toBe(195);
    expect(store.regionCount).toBe(6);
    expect(store.achievements()).toHaveLength(14);
    expect(store.combinedProgress()).toEqual({
      mastered: 0,
      total: 390,
      percent: 0,
    });
    expect(store.mistakeCount()).toBe(0);
    expect(store.pendingCount()).toBe(0);
  });

  it('updates progress, achievements and mistakes from recorded sessions', () => {
    const { store } = setup();
    const southAmerica = store.dataset
      .filter((country) => country.region === 'south-america')
      .map((country) => country.code);

    for (const session of masterAll(southAmerica)) store.recordSession(session);
    store.recordSession(finishedSession([{ code: 'fr', correct: false }]));

    expect(store.worldProgress().flags).toMatchObject({ mastered: 12 });
    expect(store.combinedProgress()).toEqual({
      mastered: 12,
      total: 390,
      percent: 3,
    });
    expect(store.unlockedAchievements()).toBe(1);
    expect(store.scope('flags', 'south-america')).toMatchObject({
      mastered: 12,
      total: 12,
    });
    expect(store.mistakeCount()).toBe(1);
  });

  it('puts every recorded session in the outbox, oldest first, with the request to send', () => {
    const { store } = setup();

    const later = store.recordSession(
      finishedSession([{ code: 'de', correct: true }], {
        startedAt: 5_000_000,
      }),
    );
    const earlier = store.recordSession(
      finishedSession([{ code: 'fr', correct: true }], {
        startedAt: 1_000_000,
      }),
    );

    expect(store.pending().map((session) => session.id)).toEqual([
      earlier.id,
      later.id,
    ]);
    expect(earlier.request).toMatchObject({
      id: earlier.id,
      submissions: [{ answer: { kind: 'choice', countryCode: 'fr' } }],
    });
  });

  it('keeps progress and the outbox across restarts', async () => {
    const local = createMemoryLocalStore();
    const first = setup(local).store;
    await first.claim(ANN);
    first.recordSession(finishedSession([{ code: 'fr', correct: false }]));
    await first.historyCursor(); // waits for the writes

    const { store } = setup(local);
    await store.load();

    expect(store.owner()).toEqual(ANN);
    expect(store.mistakeCount()).toBe(1);
    expect(store.pendingCount()).toBe(1);
  });

  it("deletes another account's data when a different player claims the device", async () => {
    const { store, local } = setup();
    await store.claim(ANN);
    store.recordSession(finishedSession([{ code: 'fr', correct: false }]));

    await store.claim(ANN);
    expect(store.mistakeCount()).toBe(1);

    await store.claim(BOB);
    expect(store.owner()).toEqual(BOB);
    expect(store.mistakeCount()).toBe(0);
    expect(await local.readSessions()).toEqual([]);
  });

  it('rebuilds the same progress whatever order sessions arrive in', async () => {
    const { store } = setup();
    // Played here: France right three times (mastered). Pulled afterwards,
    // but answered earlier on another device: France wrong. Applied in
    // arrival order the miss would come last and undo the mastery; the
    // canonical order puts it first, so France stays mastered.
    store.recordSession(
      finishedSession(
        [
          { code: 'fr', correct: true },
          { code: 'fr', correct: true },
          { code: 'fr', correct: true },
        ],
        { startedAt: 5_000_000 },
      ),
    );
    await store.addPulledPage(
      [
        pulledSession(
          historyEntry(crypto.randomUUID(), [{ code: 'fr', correct: false }], {
            startedAt: 1_000_000,
          }),
        ),
      ],
      'cursor-1',
    );

    expect(store.worldProgress().capitals.mastered).toBe(1);
    expect(store.mistakeCount()).toBe(0);
    expect(await store.historyCursor()).toBe('cursor-1');
  });

  it('counts its own session coming back from history once, as synced', async () => {
    const { store } = setup();
    const played = store.recordSession(
      finishedSession([{ code: 'fr', correct: false }]),
    );

    await store.addPulledPage(
      [
        pulledSession(
          historyEntry(played.id, [{ code: 'fr', correct: false }]),
        ),
      ],
      'cursor-1',
    );

    expect(store.pendingCount()).toBe(0);
    expect(store.mistakeCount()).toBe(1);
  });

  it('stops counting a session the API rejected', () => {
    const { store } = setup();
    const played = store.recordSession(
      finishedSession([{ code: 'fr', correct: false }]),
    );

    store.markRejected([played.id]);

    expect(store.mistakeCount()).toBe(0);
    expect(store.pendingCount()).toBe(0);
    expect(store.rejectedCount()).toBe(1);
  });

  it('forgets everything on the device', async () => {
    const { store, local } = setup();
    await store.claim(ANN);
    store.recordSession(finishedSession([{ code: 'fr', correct: false }]));

    await store.forget();

    expect(store.owner()).toBeNull();
    expect(store.mistakeCount()).toBe(0);
    expect(await local.readOwner()).toBeNull();
    expect(await local.readSessions()).toEqual([]);
  });

  it('reports a failed write and keeps the change for this run', async () => {
    const failing: LocalStore = {
      ...createMemoryLocalStore(),
      putSessions: () => Promise.reject(new Error('quota exceeded')),
    };
    const { store, reported } = setup(failing);

    store.recordSession(finishedSession([{ code: 'fr', correct: false }]));
    await store.historyCursor();

    expect(store.mistakeCount()).toBe(1);
    expect(reported).toEqual([new Error('quota exceeded')]);
  });
});
