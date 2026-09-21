import { createPool } from './database';

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
