import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool, openPglite } from './database';

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
