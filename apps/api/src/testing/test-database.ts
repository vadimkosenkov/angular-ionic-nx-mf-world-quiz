import { join } from 'node:path';
import pg from 'pg';
import { type DatabaseHandle, openPglite, openPostgres } from '../db/database';

/** The committed SQL migrations, applied to every test database. */
export const MIGRATIONS_FOLDER = join(import.meta.dirname, '../../drizzle');

/**
 * A fresh database with the real migrations applied, so tests run the same
 * SQL as production.
 *
 * By default it is an in-memory PGlite: no server, no Docker, the same in CI.
 * With `TEST_DATABASE_URL` set (a PostgreSQL server where the user may create
 * databases), each test file gets its own temporary database on that server,
 * dropped again on `close()` — test files run in parallel and never share
 * data.
 */
export async function createTestDatabase(): Promise<DatabaseHandle> {
  const serverUrl = process.env['TEST_DATABASE_URL'];
  const handle = serverUrl
    ? await createTemporaryPostgresDatabase(serverUrl)
    : await openPglite();
  await handle.migrate(MIGRATIONS_FOLDER);
  return handle;
}

async function createTemporaryPostgresDatabase(
  serverUrl: string,
): Promise<DatabaseHandle> {
  // Only letters, digits and underscores, so it is safe as an identifier.
  const name = `world_quiz_test_${crypto.randomUUID().replaceAll('-', '')}`;
  await adminQuery(serverUrl, `CREATE DATABASE ${name}`);

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const handle = openPostgres(url.toString());

  return {
    ...handle,
    description: `PostgreSQL (temporary database ${name})`,
    async close() {
      await handle.close();
      await adminQuery(
        serverUrl,
        `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`,
      );
    },
  };
}

async function adminQuery(serverUrl: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: serverUrl });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}
