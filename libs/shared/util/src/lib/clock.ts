/**
 * Abstraction over "what time is it now?".
 *
 * Time is an implicit input to several rules in this project (Timed mode ends
 * after 60 seconds, leaderboard runs are ranked by completion time, sync uses
 * timestamps). Reading `Date.now()` directly inside those rules would make them
 * non-deterministic and hard to test, so rules receive a `Clock` instead.
 *
 * Only ECMAScript built-ins are used, so this works in browsers, Node.js and
 * Capacitor's WebView alike.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** Real wall-clock time. Use at application edges (bootstrap, HTTP handlers). */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A clock that only moves when told to. Intended for tests and simulations. */
export interface ManualClock extends Clock {
  /** Moves time forward by `ms` milliseconds. */
  advance(ms: number): void;
  /** Jumps to an absolute epoch-millisecond value. */
  set(epochMs: number): void;
}

export function createManualClock(startEpochMs = 0): ManualClock {
  assertFiniteTime(startEpochMs, 'startEpochMs');
  let current = startEpochMs;

  return {
    now: () => current,
    advance(ms: number) {
      assertFiniteTime(ms, 'ms');
      if (ms < 0) {
        throw new RangeError(
          'A manual clock cannot move backwards via advance().',
        );
      }
      current += ms;
    },
    set(epochMs: number) {
      assertFiniteTime(epochMs, 'epochMs');
      current = epochMs;
    },
  };
}

function assertFiniteTime(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, received ${value}.`);
  }
}
