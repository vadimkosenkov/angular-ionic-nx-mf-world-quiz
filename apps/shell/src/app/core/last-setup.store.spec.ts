import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createMemoryStorage,
  KEY_VALUE_STORAGE,
  type MemoryStorage,
} from '@world-quiz/client/settings';
import {
  DEFAULT_SETUP,
  LAST_SETUP_STORAGE_KEY,
  LastSetupStore,
  parseSetup,
  type RememberedSetup,
} from './last-setup.store';

function setup(
  stored?: Readonly<Record<string, string>>,
  override?: Partial<MemoryStorage>,
) {
  const reported: unknown[] = [];
  const storage = { ...createMemoryStorage({ ...stored }), ...override };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: KEY_VALUE_STORAGE, useValue: storage },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => reported.push(error) },
      },
    ],
  });
  return { store: TestBed.inject(LastSetupStore), storage, reported };
}

/** Lets the pending write run. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

const EUROPE_HARD: RememberedSetup = {
  category: 'flags',
  scope: 'europe',
  difficulty: 'hard',
  mode: 'timed',
};

describe('LastSetupStore', () => {
  it('offers the defaults to a player who has never started a quiz', async () => {
    const { store } = setup();
    await store.load();

    expect(store.setup()).toEqual(DEFAULT_SETUP);
  });

  it('reads back the setup a quiz was last started with', async () => {
    const { store } = setup({
      [LAST_SETUP_STORAGE_KEY]: JSON.stringify(EUROPE_HARD),
    });
    await store.load();

    expect(store.setup()).toEqual(EUROPE_HARD);
  });

  it('remembers a setup and writes it to the device', async () => {
    const { store, storage } = setup();
    await store.load();

    store.remember(EUROPE_HARD);
    await settle();

    expect(store.setup()).toEqual(EUROPE_HARD);
    expect(
      JSON.parse(storage.snapshot()[LAST_SETUP_STORAGE_KEY] ?? 'null'),
    ).toEqual(EUROPE_HARD);
  });

  it('keeps the player on the screen when storage cannot be written', async () => {
    const failure = new Error('no room');
    const { store, reported } = setup(undefined, {
      set: () => Promise.reject(failure),
    });
    await store.load();

    store.remember(EUROPE_HARD);
    await settle();

    // The choice still applies to this session; only the device forgets it.
    expect(store.setup()).toEqual(EUROPE_HARD);
    expect(reported).toEqual([failure]);
  });

  it('reports a device that cannot be read, and falls back to the defaults', async () => {
    const failure = new Error('locked');
    const { store, reported } = setup(undefined, {
      get: () => Promise.reject(failure),
    });

    await store.load();

    expect(store.setup()).toEqual(DEFAULT_SETUP);
    expect(reported).toEqual([failure]);
  });
});

describe('parseSetup', () => {
  it('falls back to the defaults for nothing, rubbish or the wrong shape', () => {
    for (const raw of [null, '', 'not json', '[]', '"europe"', 'null']) {
      expect(parseSetup(raw), raw ?? 'null').toEqual(DEFAULT_SETUP);
    }
  });

  it('keeps the fields a later release still understands', () => {
    // A region that was renamed and a mode that was dropped cost only
    // themselves: the category and difficulty beside them still apply.
    const stored = parseSetup(
      JSON.stringify({
        category: 'flags',
        scope: 'atlantis',
        difficulty: 'hard',
        mode: 'marathon',
      }),
    );

    expect(stored).toEqual({
      category: 'flags',
      scope: DEFAULT_SETUP.scope,
      difficulty: 'hard',
      mode: DEFAULT_SETUP.mode,
    });
  });

  it('refuses Practice Mistakes, which is an action and not a preference', () => {
    expect(parseSetup(JSON.stringify({ mode: 'practice' })).mode).toBe('fixed');
  });
});
