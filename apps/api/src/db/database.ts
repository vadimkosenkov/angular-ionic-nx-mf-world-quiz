import { PGlite } from '@electric-sql/pglite';
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

/** A PostgreSQL server, through a `pg` connection pool. */
export function openPostgres(connectionString: string): DatabaseHandle {
  const pool = new pg.Pool({ connectionString });
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
  const client = await PGlite.create(dataDir);
  const db = drizzlePglite({ client, schema });
  return {
    db,
    description: dataDir ? `PGlite (${dataDir})` : 'PGlite (in memory)',
    migrate: (folder) => migratePglite(db, { migrationsFolder: folder }),
    close: () => client.close(),
  };
}
