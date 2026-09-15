import { createManualClock, systemClock } from './clock';

describe('systemClock', () => {
  it('returns the current epoch time in milliseconds', () => {
    const before = Date.now();
    const value = systemClock.now();
    const after = Date.now();

    expect(value).toBeGreaterThanOrEqual(before);
    expect(value).toBeLessThanOrEqual(after);
  });
});

describe('createManualClock', () => {
  it('starts at the given time and stays there until moved', () => {
    const clock = createManualClock(1_000);

    expect(clock.now()).toBe(1_000);
    expect(clock.now()).toBe(1_000);
  });

  it('defaults to epoch zero', () => {
    expect(createManualClock().now()).toBe(0);
  });

  it('advances forward by the given amount', () => {
    const clock = createManualClock(1_000);

    clock.advance(59_999);

    expect(clock.now()).toBe(60_999);
  });

  it('can jump to an absolute time, including backwards (e.g. device clock changes)', () => {
    const clock = createManualClock(5_000);

    clock.set(2_000);

    expect(clock.now()).toBe(2_000);
  });

  it('rejects negative advances', () => {
    const clock = createManualClock();

    expect(() => clock.advance(-1)).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects non-finite value %s',
    (value) => {
      expect(() => createManualClock(value)).toThrow(RangeError);
      expect(() => createManualClock().advance(value)).toThrow(RangeError);
      expect(() => createManualClock().set(value)).toThrow(RangeError);
    },
  );
});
