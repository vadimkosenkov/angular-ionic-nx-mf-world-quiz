import { describe, expect, it } from 'vitest';
import { runShareCard, type RunShareFacts } from './result-share-card';

/** Echoes the key, so a test sees which text the card asked for. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params ? `${key}(${Object.values(params).join(',')})` : key;

const run: RunShareFacts = {
  category: 'capitals',
  scope: 'europe',
  difficulty: 'easy',
  mode: 'fixed',
  correct: 18,
  answered: 20,
  accuracyPercent: 90,
  duration: '1:12',
  perfect: false,
  rank: null,
};

describe('runShareCard', () => {
  it('puts the score first and the figures under it', () => {
    const card = runShareCard(run, translate);

    expect(card.headline).toBe('18 / 20');
    expect(card.stats).toEqual([
      { label: 'results.accuracy', value: '90%' },
      { label: 'results.time', value: '1:12' },
    ]);
  });

  it('names what was played, without repeating the app', () => {
    const card = runShareCard(run, translate);

    // The band at the top already says World Quiz.
    expect(card.title).toBe('share.title');
    expect(card.subject).toBe(
      'share.result.subject(categories.capitals,regions.europe,difficulty.easy)',
    );
  });

  it('names how it was played on a line of its own', () => {
    expect(runShareCard(run, translate).detail).toBe('modes.fixed');
  });

  it('calls a practice round what the player chose, not what it runs as', () => {
    // Practice Mistakes is a Quick round to the domain.
    const card = runShareCard({ ...run, mode: 'practice' }, translate);

    expect(card.detail).toBe('modes.practice');
  });

  it('says nothing between the score and the figures about an ordinary run', () => {
    expect(runShareCard(run, translate).note).toBeNull();
  });

  it('celebrates a perfect run', () => {
    const card = runShareCard({ ...run, perfect: true }, translate);

    expect(card.note).toBe('results.perfect');
  });

  it('prefers the rank the server gave to the perfect run', () => {
    const card = runShareCard(
      { ...run, perfect: true, rank: 'Ranked #2' },
      translate,
    );

    expect(card.note).toBe('Ranked #2');
  });
});
