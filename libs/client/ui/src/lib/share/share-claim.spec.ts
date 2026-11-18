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

  it('claims no place on a board nobody else is on', () => {
    // The picture writes "First result on this board" there, and a claim
    // of being first of one beside it would invite laughter.
    expect(shareClaim({ rank: 1, players: 1 })).toBe('plain');
    expect(shareClaim({ rank: 1, players: 1, perfect: true })).toBe('perfect');
    // The player's own best is still news, whoever else is on the board.
    expect(shareClaim({ personalRecord: true, rank: 1, players: 1 })).toBe(
      'record',
    );
    expect(shareClaim({ rank: 1, players: 2 })).toBe('first');
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
