import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool, openPglite, poolSslOptions } from './database';

describe('poolSslOptions', () => {
  // A managed database is reached over the public internet: the connection
  // is encrypted and the certificate verified, whatever the URL says.
  it.each([
    'postgres://user:pw@ep-cool-name.eu-central-1.aws.neon.tech/db',
    'postgres://user:pw@db.example.test:5432/world_quiz?sslmode=disable',
  ])('verifies TLS for %s', (url) => {
    expect(poolSslOptions(url)).toEqual({ rejectUnauthorized: true });
  });

  it.each([
    'postgres://localhost:5432/world_quiz',
    'postgres://user@127.0.0.1:5432/world_quiz',
  ])('uses no TLS for a database on this machine (%s)', (url) => {
    expect(poolSslOptions(url)).toBe(false);
  });
});

describe('createPool', () => {
  it('handles errors of idle connections instead of crashing the process', async () => {
    const reported: Error[] = [];
    // No connection is opened until the first query, so no server is needed.
    const pool = createPool('postgres://localhost:5432/unused', (error) =>
      reported.push(error),
    );

    const failure = new Error(
      'terminating connection due to administrator command',
    );
    // Without a listener, emitting `error` would throw here.
    expect(() => pool.emit('error', failure)).not.toThrow();
    expect(reported).toEqual([failure]);

    await pool.end();
  });
});

describe('openPglite', () => {
  // Initialising a PGlite database on disk takes about a second alone, and
  // well over the default 5 s when every project's tests run in parallel.
  it(
    'creates missing parent directories, as on a fresh checkout',
    {
      timeout: 30_000,
    },
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'world-quiz-'));
      try {
        const handle = await openPglite(join(root, '.data', 'pglite'));
        await handle.close();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});
