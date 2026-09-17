/**
 * Deterministic pseudo-random numbers.
 *
 * Quiz sessions are generated from a string seed. The same seed always
 * produces the same question order and the same Easy-mode choices, which:
 *  - makes tests reproducible,
 *  - makes leaderboard challenge runs comparable,
 *  - lets the server regenerate the exact questions a client saw and
 *    re-grade the submitted answers instead of trusting the client.
 *
 * This is NOT cryptographically secure and must never be used for secrets.
 * Algorithms: cyrb128 (string → 128-bit state) and sfc32 (Small Fast Counter),
 * both public domain.
 */

/** A source of uniformly distributed numbers in `[0, 1)`. */
export interface RandomSource {
  next(): number;
}

export function createSeededRandom(seed: string): RandomSource {
  let [a, b, c, d] = cyrb128(seed);

  return {
    next(): number {
      a |= 0;
      b |= 0;
      c |= 0;
      d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4_294_967_296;
    },
  };
}

/**
 * Derives an independent seed for one purpose of a session, so e.g. the
 * choices of question 7 do not depend on how many numbers question 6 consumed.
 */
export function deriveSeed(
  seed: string,
  ...parts: readonly (string | number)[]
): string {
  return [seed, ...parts].join('|');
}

/** Integer in `[0, maxExclusive)`. */
export function randomInt(random: RandomSource, maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(
      `maxExclusive must be a positive integer, received ${maxExclusive}`,
    );
  }
  return Math.floor(random.next() * maxExclusive);
}

/** Returns a shuffled copy (Fisher–Yates). The input is not modified. */
export function shuffled<T>(items: readonly T[], random: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = randomInt(random, index + 1);
    const current = result[index] as T;
    result[index] = result[swapIndex] as T;
    result[swapIndex] = current;
  }
  return result;
}

function cyrb128(text: string): [number, number, number, number] {
  let h1 = 1_779_033_703;
  let h2 = 3_144_134_277;
  let h3 = 1_013_904_242;
  let h4 = 2_773_480_762;

  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = h2 ^ Math.imul(h1 ^ code, 597_399_067);
    h2 = h3 ^ Math.imul(h2 ^ code, 2_869_860_233);
    h3 = h4 ^ Math.imul(h3 ^ code, 951_274_213);
    h4 = h1 ^ Math.imul(h4 ^ code, 2_716_044_179);
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597_399_067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2_869_860_233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951_274_213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2_716_044_179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;

  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
