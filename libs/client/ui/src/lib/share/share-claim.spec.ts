import { describe, expect, it } from 'vitest';
import { shareClaim, shareMedal } from './share-claim';

describe('shareClaim', () => {
  it('says a new record before anything else', () => {
    // A player who is second and has just beaten their own best would
    // rather say so than report the place.
    expect(shareClaim({ personalRecord: true, rank: 2, perfect: true })).toBe(
      'record',
    );
  });

  it('names first place, the top three and the board itself', () => {
    expect(shareClaim({ rank: 1 })).toBe('first');
    expect(shareClaim({ rank: 2 })).toBe('topThree');
    expect(shareClaim({ rank: 3 })).toBe('topThree');
    expect(shareClaim({ rank: 4 })).toBe('ranked');
    expect(shareClaim({ rank: 248 })).toBe('ranked');
  });

  it('still celebrates a flawless run that no board ranks', () => {
    // Endless and Practice Mistakes reach no board and can be played
    // perfectly.
    expect(shareClaim({ perfect: true })).toBe('perfect');
    expect(shareClaim({ perfect: true, rank: null })).toBe('perfect');
  });

  it('claims nothing it cannot back up', () => {
    expect(shareClaim({})).toBe('plain');
    expect(shareClaim({ perfect: false, rank: null })).toBe('plain');
  });
});

describe('shareMedal', () => {
  it('gives a medal to the first three places only', () => {
    expect(shareMedal(1)).toBe(1);
    expect(shareMedal(3)).toBe(3);
    // Below the third the number speaks for itself, and a medal for #47
    // would be a lie.
    expect(shareMedal(4)).toBeNull();
    expect(shareMedal(null)).toBeNull();
    expect(shareMedal(undefined)).toBeNull();
  });
});
