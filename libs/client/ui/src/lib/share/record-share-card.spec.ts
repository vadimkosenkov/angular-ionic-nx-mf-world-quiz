import { describe, expect, it } from 'vitest';
import { recordShareCard, type RecordShareFacts } from './record-share-card';

/** Echoes the key, so a test sees which text the card asked for. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key}(${Object.values(params).join(',')})` : key;

const record: RecordShareFacts = {
  board: 'Capitals · Europe · Easy · Quick round',
  score: '4:07.3',
  scoreLabel: 'Time',
  rank: 2,
  players: 3,
  fresh: true,
};

describe('recordShareCard', () => {
  it('leads with the record as news, over the board it was set on', () => {
    const card = recordShareCard(record, translate);

    expect(card.claim).toBe('share.claim.record');
    expect(card.subject).toBe('Capitals · Europe · Easy · Quick round');
  });

  it('claims the place of a record the player is looking up later', () => {
    // "New personal record!" is news; a record set weeks ago is not.
    const card = recordShareCard({ ...record, fresh: false }, translate);

    expect(card.claim).toBe('share.claim.topThree');
  });

  it('backs the claim with the score, big, and the place as a medal', () => {
    const card = recordShareCard(record, translate);

    expect(card.headline).toBe('4:07.3');
    // The figure is bare, so the label under it says what it is.
    expect(card.headlineLabel).toBe('Time');
    expect(card.medal).toBe(2);
    // The medal carries the place, so the line under it is never drawn.
    expect(card.note).toBe('leaderboard.place(2,3)');
  });

  it('backs it with the answers on a board that counts them', () => {
    const card = recordShareCard(
      { ...record, score: '21', scoreLabel: 'Correct' },
      translate,
    );

    expect(card.headline).toBe('21');
    expect(card.headlineLabel).toBe('Correct');
  });

  it('gives a place below the third no medal', () => {
    const card = recordShareCard(
      { ...record, fresh: false, rank: 8, players: 40 },
      translate,
    );

    expect(card.medal).toBeNull();
    expect(card.note).toBe('leaderboard.place(8,40)');
  });

  it('does not boast about being first of one', () => {
    const card = recordShareCard({ ...record, rank: 1, players: 1 }, translate);

    expect(card.medal).toBeNull();
    expect(card.note).toBe('share.firstOnBoard');
  });

  it('repeats no figure the claim and the headline already carry', () => {
    expect(recordShareCard(record, translate).stats).toEqual([]);
  });

  it('is drawn in the brand gradient, as the app celebrates a record', () => {
    expect(recordShareCard(record, translate).tone).toBe('record');
  });

  it('says nothing about the mode, because the board names it', () => {
    expect(recordShareCard(record, translate).detail).toBeUndefined();
  });

  it('invites the reader to beat it', () => {
    expect(recordShareCard(record, translate).callToAction).toBe(
      'share.beatMe',
    );
  });
});
