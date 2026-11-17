import { describe, expect, it } from 'vitest';
import { recordShareCard, type RecordShareFacts } from './record-share-card';

/** Echoes the key, so a test sees which text the card asked for. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key}(${Object.values(params).join(',')})` : key;

const record: RecordShareFacts = {
  board: 'Capitals · Europe · Easy · Quick round',
  score: '4:07.3',
  rank: 2,
  players: 3,
};

describe('recordShareCard', () => {
  it('leads with what the board ranks by, under the board it is on', () => {
    const card = recordShareCard(record, translate);

    expect(card.headline).toBe('4:07.3');
    expect(card.subject).toBe('Capitals · Europe · Easy · Quick round');
    expect(card.note).toBe('share.record.perfect');
  });

  it('leads with the answers on a board that counts them', () => {
    const card = recordShareCard({ ...record, score: '21 correct' }, translate);

    expect(card.headline).toBe('21 correct');
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
