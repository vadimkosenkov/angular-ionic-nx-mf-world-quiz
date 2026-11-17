import { describe, expect, it } from 'vitest';
import { recordShareCard, type RecordShareFacts } from './record-share-card';

/** Echoes the key, so a test sees which text the card asked for. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key}(${Object.values(params).join(',')})` : key;

const record: RecordShareFacts = {
  board: 'capitals-easy',
  time: '4:07.3',
  rank: 2,
  players: 3,
};

describe('recordShareCard', () => {
  it('leads with the time, because that is what the board ranks on', () => {
    const card = recordShareCard(record, translate);

    expect(card.headline).toBe('4:07.3');
    expect(card.subject).toBe('leaderboard.boards.capitals-easy');
    expect(card.note).toBe('share.record.perfect');
  });

  it('shows the place and how many players it is out of', () => {
    const card = recordShareCard(record, translate);

    expect(card.stats).toEqual([
      { label: 'share.record.place', value: '#2' },
      { label: 'share.record.players', value: '3' },
    ]);
  });

  it('says nothing about the mode, because the board names it', () => {
    expect(recordShareCard(record, translate).detail).toBeUndefined();
  });
});
