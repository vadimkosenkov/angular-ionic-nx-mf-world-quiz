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
  players: null,
};

describe('runShareCard', () => {
  it('leads with a claim and backs it with the score', () => {
    const card = runShareCard(run, translate);

    expect(card.claim).toBe('share.claim.plain');
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

  it('invites the reader to beat it', () => {
    expect(runShareCard(run, translate).callToAction).toBe('share.beatMe');
  });

  it('says nothing about a place a run never reached', () => {
    const card = runShareCard(run, translate);

    expect(card.note).toBeNull();
    expect(card.medal ?? null).toBeNull();
  });

  it('claims a flawless run that no board ranks', () => {
    const card = runShareCard({ ...run, perfect: true }, translate);

    expect(card.claim).toBe('share.claim.perfect');
  });

  it('prefers the place to the flawless run: the place is the louder fact', () => {
    const card = runShareCard(
      { ...run, perfect: true, rank: 2, players: 47 },
      translate,
    );

    expect(card.claim).toBe('share.claim.topThree');
    expect(card.medal).toBe(2);
    expect(card.note).toBe('leaderboard.place(2,47)');
  });

  it('says first place out loud, with its medal', () => {
    const card = runShareCard({ ...run, rank: 1, players: 12 }, translate);

    expect(card.claim).toBe('share.claim.first');
    expect(card.medal).toBe(1);
  });

  it('gives a place below the third no medal', () => {
    const card = runShareCard({ ...run, rank: 9, players: 47 }, translate);

    expect(card.claim).toBe('share.claim.ranked');
    expect(card.medal).toBeNull();
    expect(card.note).toBe('leaderboard.place(9,47)');
  });

  it('does not boast about being first of one', () => {
    const card = runShareCard({ ...run, rank: 1, players: 1 }, translate);

    expect(card.medal).toBeNull();
    expect(card.note).toBe('share.firstOnBoard');
  });
});
