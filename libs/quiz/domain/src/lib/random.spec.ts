import { createSeededRandom, deriveSeed, randomInt, shuffled } from './random';

const take = (seed: string, count: number) => {
  const random = createSeededRandom(seed);
  return Array.from({ length: count }, () => random.next());
};

describe('createSeededRandom', () => {
  it('is deterministic for the same seed', () => {
    expect(take('session-1', 5)).toEqual(take('session-1', 5));
  });

  it('produces different sequences for different seeds', () => {
    expect(take('session-1', 5)).not.toEqual(take('session-2', 5));
  });

  it('produces numbers in [0, 1)', () => {
    for (const value of take('range', 10_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('is roughly uniform', () => {
    const buckets = Array.from({ length: 10 }, () => 0);
    for (const value of take('uniform', 50_000)) {
      buckets[Math.floor(value * 10)]! += 1;
    }
    for (const bucket of buckets) {
      expect(bucket).toBeGreaterThan(4_500);
      expect(bucket).toBeLessThan(5_500);
    }
  });
});

describe('deriveSeed', () => {
  it('joins parts into an independent, stable seed', () => {
    expect(deriveSeed('abc', 'choices', 7)).toBe('abc|choices|7');
    expect(take(deriveSeed('abc', 'choices', 7), 3)).not.toEqual(
      take(deriveSeed('abc', 'choices', 8), 3),
    );
  });
});

describe('randomInt', () => {
  it('stays within bounds', () => {
    const random = createSeededRandom('int');
    for (let i = 0; i < 1_000; i++) {
      const value = randomInt(random, 4);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(4);
    }
  });

  it.each([0, -1, 2.5, Number.NaN])('rejects invalid bound %s', (bound) => {
    expect(() => randomInt(createSeededRandom('x'), bound)).toThrow(RangeError);
  });
});

describe('shuffled', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  it('returns a permutation without modifying the input', () => {
    const copy = [...items];
    const result = shuffled(items, createSeededRandom('perm'));

    expect(items).toEqual(copy);
    expect([...result].sort()).toEqual(items);
  });

  it('is deterministic per seed and actually reorders', () => {
    const first = shuffled(items, createSeededRandom('order'));

    expect(shuffled(items, createSeededRandom('order'))).toEqual(first);
    expect(first).not.toEqual(items);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffled([], createSeededRandom('x'))).toEqual([]);
    expect(shuffled(['only'], createSeededRandom('x'))).toEqual(['only']);
  });
});
