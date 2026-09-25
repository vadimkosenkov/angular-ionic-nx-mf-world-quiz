import { PGlite } from '@electric-sql/pglite';
import { mkdirSync } from 'node:fs';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import { migrate as migratePostgres } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import { schema, type Schema } from './schema';

/** The query API every repository uses, whichever driver is behind it. */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export interface DatabaseHandle {
  readonly db: Database;
  /** Human-readable, without credentials, for start-up logs. */
  readonly description: string;
  /** Applies the SQL migrations in `folder` that have not run yet. */
  migrate(folder: string): Promise<void>;
  close(): Promise<void>;
}

/** Where errors of idle pooled connections are reported. */
export type PoolErrorHandler = (error: Error) => void;

const logPoolError: PoolErrorHandler = (error) =>
  console.error('[api] idle database connection failed', error);

/**
 * A `pg` connection pool that survives a lost connection.
 *
 * When an idle pooled connection breaks (the server restarts, the network
 * drops, an idle timeout on the server side), `pg` emits `error` on the pool.
 * Without a listener, Node treats that as an unhandled `error` event and ends
 * the process. With one, the broken client is discarded and the next query
 * opens a new connection.
 */
/**
 * Whether to encrypt the connection, decided from the address.
 *
 * A managed database (Neon, Render, anything else) is reached over the
 * public internet and must be encrypted, with its certificate verified —
 * otherwise anyone between here and there reads the player's data and the
 * credentials in the URL. A database on this machine (development, tests,
 * a container on the same host) has no certificate and needs none.
 *
 * It is decided here rather than left to the connection string, because a
 * missing `sslmode` would then silently mean "no encryption".
 */
export function poolSslOptions(
  connectionString: string,
): false | { rejectUnauthorized: boolean } {
  const host = new URL(connectionString).hostname;
  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  return local ? false : { rejectUnauthorized: true };
}

export function createPool(
  connectionString: string,
  onError: PoolErrorHandler = logPoolError,
): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    ssl: poolSslOptions(connectionString),
  });
  pool.on('error', onError);
  return pool;
}

/** A PostgreSQL server, through a `pg` connection pool. */
export function openPostgres(
  connectionString: string,
  onError?: PoolErrorHandler,
): DatabaseHandle {
  const pool = createPool(connectionString, onError);
  const db = drizzlePostgres({ client: pool, schema });
  return {
    db,
    description: 'PostgreSQL',
    migrate: (folder) => migratePostgres(db, { migrationsFolder: folder }),
    close: () => pool.end(),
  };
}

/**
 * PGlite: PostgreSQL compiled to WebAssembly, running inside this process.
 * `dataDir` persists to disk; without it the database lives in memory (tests).
 * It serves one connection at a time, so it is for development and tests only.
 */
export async function openPglite(dataDir?: string): Promise<DatabaseHandle> {
  // PGlite creates only the last directory; on a fresh checkout `.data` does
  // not exist yet.
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const client = await PGlite.create(dataDir);
  const db = drizzlePglite({ client, schema });
  return {
    db,
    description: dataDir ? `PGlite (${dataDir})` : 'PGlite (in memory)',
    migrate: (folder) => migratePglite(db, { migrationsFolder: folder }),
    close: () => client.close(),
  };
}
