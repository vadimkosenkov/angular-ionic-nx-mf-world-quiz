import 'fake-indexeddb/auto';
import { createDexieLocalStore } from './dexie-local-store';
import type { LocalSession } from './local-store';
import { playedSession } from './session-mapping';
import { ANN, finishedSession } from '../testing';

const session = (id: string, sync: LocalSession['sync'] = 'pending') => ({
  ...playedSession(finishedSession([{ code: 'fr', correct: true }]), id),
  sync,
});

describe('createDexieLocalStore (IndexedDB)', () => {
  // A new database per test: fake-indexeddb keeps databases for the file.
  const name = () => `world-quiz-test-${crypto.randomUUID()}`;

  it('keeps the owner, sessions and cursor across reopening the database', async () => {
    const database = name();
    const first = createDexieLocalStore(database);
    await first.writeOwner(ANN);
    await first.putSessions([session('a'), session('b', 'synced')]);
    await first.savePulledPage([session('c', 'synced')], 'cursor-1');

    const reopened = createDexieLocalStore(database);

    expect(await reopened.readOwner()).toEqual(ANN);
    expect(
      (await reopened.readSessions()).map(({ id, sync }) => [id, sync]).sort(),
    ).toEqual([
      ['a', 'pending'],
      ['b', 'synced'],
      ['c', 'synced'],
    ]);
    expect(await reopened.readCursor()).toBe('cursor-1');
  });

  it('replaces a session with the same id', async () => {
    const store = createDexieLocalStore(name());
    await store.putSessions([session('a')]);

    await store.putSessions([session('a', 'synced')]);

    expect((await store.readSessions()).map((s) => s.sync)).toEqual(['synced']);
  });

  it('starts empty and clears everything', async () => {
    const store = createDexieLocalStore(name());
    expect(await store.readOwner()).toBeNull();
    expect(await store.readCursor()).toBeNull();

    await store.writeOwner(ANN);
    await store.savePulledPage([session('a')], 'cursor-1');
    await store.clear();

    expect(await store.readOwner()).toBeNull();
    expect(await store.readSessions()).toEqual([]);
    expect(await store.readCursor()).toBeNull();
  });
});
