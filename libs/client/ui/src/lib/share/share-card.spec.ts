import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHARE_CARD_PALETTE,
  readShareCardPalette,
  type ShareCard,
  type ShareCardOp,
  shareCardPlan,
} from './share-card';

const run: ShareCard = {
  title: 'World Quiz',
  subject: 'Capitals · Europe · Easy',
  detail: 'Quick round',
  headline: '18 / 20',
  note: 'Perfect run!',
  stats: [
    { label: 'Accuracy', value: '90%' },
    { label: 'Time', value: '1:12' },
  ],
};

const texts = (ops: readonly ShareCardOp[]): string[] =>
  ops.filter((op) => op.kind === 'text').map((op) => op.text);

describe('shareCardPlan', () => {
  it('is a square with every word of the card on it', () => {
    const plan = shareCardPlan(run);

    expect(plan.width).toBe(plan.height);
    expect(texts(plan.ops)).toEqual([
      'World Quiz',
      'Capitals · Europe · Easy',
      'Quick round',
      '18 / 20',
      'Perfect run!',
      '90%',
      'Accuracy',
      '1:12',
      'Time',
    ]);
  });

  it('leaves out what a card has nothing to say about', () => {
    const plan = shareCardPlan({
      ...run,
      note: null,
      detail: null,
      stats: [],
    });

    expect(texts(plan.ops)).toEqual([
      'World Quiz',
      'Capitals · Europe · Easy',
      '18 / 20',
    ]);
  });

  it('says nowhere on the picture where the app lives', () => {
    // The address travels in the message beside the file; a picture of a
    // result is a result, not an advertisement.
    const plan = shareCardPlan(run);

    expect(texts(plan.ops).join(' ')).not.toContain('http');
  });

  it('keeps every word inside the card', () => {
    const plan = shareCardPlan(run);
    const card = plan.ops.find((op) => op.kind === 'card');

    if (card?.kind !== 'card') throw new Error('the plan draws no card');
    for (const op of plan.ops) {
      if (op.kind !== 'text') continue;
      // `fillText` is given this width and condenses the text to fit, so a
      // long region name cannot run over the card's edge.
      expect(op.x - op.maxWidth / 2).toBeGreaterThanOrEqual(card.x);
      expect(op.x + op.maxWidth / 2).toBeLessThanOrEqual(card.x + card.width);
      expect(op.y).toBeLessThanOrEqual(card.y + card.height);
    }
  });

  it('spreads three figures across the card without overlapping', () => {
    const plan = shareCardPlan({
      ...run,
      stats: [
        { label: 'Accuracy', value: '90%' },
        { label: 'Time', value: '1:12' },
        { label: 'Place', value: '#2' },
      ],
    });
    const values = plan.ops.filter(
      (op): op is Extract<ShareCardOp, { kind: 'text' }> =>
        op.kind === 'text' && ['90%', '1:12', '#2'].includes(op.text),
    );

    expect(values).toHaveLength(3);
    const [first, second, third] = values as [
      (typeof values)[number],
      (typeof values)[number],
      (typeof values)[number],
    ];
    expect(second.x - first.x).toBeCloseTo(third.x - second.x);
    expect(second.x - first.x).toBeGreaterThan(first.maxWidth);
  });

  it('paints the picture in the colours it is given', () => {
    const plan = shareCardPlan(run, {
      ...DEFAULT_SHARE_CARD_PALETTE,
      background: '#000000',
      headline: '#00ff00',
    });

    expect(plan.ops[0]).toEqual({ kind: 'fill', color: '#000000' });
    const headline = plan.ops.find(
      (op) => op.kind === 'text' && op.text === '18 / 20',
    );
    expect(headline).toMatchObject({ color: '#00ff00' });
  });
});

describe('readShareCardPalette', () => {
  it('reads the theme the player is looking at', () => {
    const element = document.createElement('div');
    element.style.setProperty('--wq-color-background', 'rgb(1, 2, 3)');
    element.style.setProperty('--wq-color-text-primary', 'rgb(4, 5, 6)');
    document.body.append(element);

    const palette = readShareCardPalette(element);

    expect(palette.background).toBe('rgb(1, 2, 3)');
    expect(palette.text).toBe('rgb(4, 5, 6)');
    // A token the document does not define falls back to the light theme,
    // so the card is never drawn with a missing colour.
    expect(palette.surface).toBe(DEFAULT_SHARE_CARD_PALETTE.surface);
    element.remove();
  });

  it('falls back entirely without a document', () => {
    expect(readShareCardPalette(null)).toEqual(DEFAULT_SHARE_CARD_PALETTE);
  });
});
