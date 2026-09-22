import type { User } from '@world-quiz/shared/contracts';
import { Dexie, type EntityTable } from 'dexie';
import type { LocalSession, LocalStore } from './local-store';

/** The IndexedDB database of the app. */
export const LOCAL_DATABASE_NAME = 'world-quiz';

type MetaEntry =
  | { readonly key: 'owner'; readonly value: User }
  | { readonly key: 'cursor'; readonly value: string | null };

type WorldQuizDatabase = Dexie & {
  sessions: EntityTable<LocalSession, 'id'>;
  meta: EntityTable<MetaEntry, 'key'>;
};

/**
 * `LocalStore` on IndexedDB through Dexie.
 *
 * Schema versions are declared here and never edited: a new version is a new
 * `version(n)` block with an upgrade function, which Dexie runs on the
 * device the next time the app opens the database.
 */
export function createDexieLocalStore(name = LOCAL_DATABASE_NAME): LocalStore {
  const db = new Dexie(name) as WorldQuizDatabase;
  // Only indexed fields are listed: the primary key, and `sync` so the
  // outbox is a query rather than a scan.
  db.version(1).stores({ sessions: 'id, sync', meta: 'key' });

  const readMeta = async <K extends MetaEntry['key']>(key: K) =>
    (await db.meta.get(key)) as Extract<MetaEntry, { key: K }> | undefined;

  return {
    readOwner: async () => (await readMeta('owner'))?.value ?? null,
    writeOwner: async (owner) => {
      await db.meta.put({ key: 'owner', value: owner });
    },
    readSessions: () => db.sessions.toArray(),
    putSessions: async (sessions) => {
      await db.sessions.bulkPut([...sessions]);
    },
    readCursor: async () => (await readMeta('cursor'))?.value ?? null,
    savePulledPage: (sessions, cursor) =>
      db.transaction('rw', db.sessions, db.meta, async () => {
        await db.sessions.bulkPut([...sessions]);
        await db.meta.put({ key: 'cursor', value: cursor });
      }),
    clear: () =>
      db.transaction('rw', db.sessions, db.meta, async () => {
        await db.sessions.clear();
        await db.meta.clear();
      }),
  };
}
