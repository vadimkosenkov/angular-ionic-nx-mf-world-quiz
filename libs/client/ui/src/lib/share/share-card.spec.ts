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
  claim: 'A flawless run!',
  headline: '18 / 20',
  subject: 'Capitals · Europe · Easy',
  detail: 'Quick round',
  stats: [
    { label: 'Accuracy', value: '90%' },
    { label: 'Time', value: '1:12' },
  ],
  callToAction: 'Beat my result',
};

const texts = (ops: readonly ShareCardOp[]): string[] =>
  ops.filter((op) => op.kind === 'text').map((op) => op.text);

/** Where a given word sits, for the tests about reading order. */
const baselineOf = (plan: { ops: readonly ShareCardOp[] }, text: string) => {
  const op = plan.ops.find(
    (candidate) => candidate.kind === 'text' && candidate.text === text,
  );
  if (op?.kind !== 'text') throw new Error(`the plan never draws "${text}"`);
  return op;
};

describe('shareCardPlan', () => {
  it('is a square with every word of the card on it', () => {
    const plan = shareCardPlan(run);

    expect(plan.width).toBe(plan.height);
    expect(texts(plan.ops)).toEqual([
      'World Quiz',
      'A flawless run!',
      '18 / 20',
      'Capitals · Europe · Easy',
      'Quick round',
      // The label is above its figure, the way the app's own results card
      // writes them, so the two read like one family.
      'Accuracy',
      '90%',
      'Time',
      '1:12',
      'Beat my result',
    ]);
  });

  it('reads claim, then figure, then what was played', () => {
    const plan = shareCardPlan(run);

    const claim = baselineOf(plan, 'A flawless run!');
    const headline = baselineOf(plan, '18 / 20');
    const subject = baselineOf(plan, 'Capitals · Europe · Easy');

    expect(claim.y).toBeLessThan(headline.y);
    expect(headline.y).toBeLessThan(subject.y);
    // The number is the loudest thing, but the claim is read first and is
    // far bigger than the settings under it.
    expect(claim.size).toBeGreaterThan(subject.size * 1.4);
  });

  it('breaks a long claim over two lines instead of shrinking it to nothing', () => {
    const plan = shareCardPlan({
      ...run,
      claim: "I'm on the leaderboard with a flawless run",
    });
    const lines = texts(plan.ops).slice(1, 3);

    expect(lines).toEqual(["I'm on the leaderboard", 'with a flawless run']);
    expect(baselineOf(plan, "I'm on the leaderboard").size).toBeGreaterThan(40);
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
      'A flawless run!',
      '18 / 20',
      'Capitals · Europe · Easy',
      'Beat my result',
    ]);
  });

  it('draws a medal for a place in the first three, with the place on it', () => {
    const plan = shareCardPlan({ ...run, medal: 2, note: '#2 of 47' });
    const disc = plan.ops.find((op) => op.kind === 'disc');

    // A gold disc with the place written on it in white, as a medal is
    // engraved: the same object in either theme.
    if (disc?.kind !== 'disc') throw new Error('the plan draws no medal');
    expect(disc.radius).toBeGreaterThan(40);
    expect(texts(plan.ops)).toContain('#2');
    // The place is written on the medal; a line under it would say it twice.
    expect(texts(plan.ops)).not.toContain('#2 of 47');
  });

  it('draws all three places in the one gold, and the place says which', () => {
    const metalOf = (medal: 1 | 2 | 3) => {
      const disc = shareCardPlan({ ...run, medal }).ops.find(
        (op) => op.kind === 'disc',
      );
      if (disc?.kind !== 'disc') throw new Error('the plan draws no medal');
      return disc.fill;
    };

    // Silver and bronze are a grey and a brown disc on a white card; what
    // the picture says is that the run reached the first three.
    expect(new Set([metalOf(1), metalOf(2), metalOf(3)]).size).toBe(1);
    expect(metalOf(2)).toBe('#fdbe02');
  });

  it('writes a place no medal carries as a line of its own', () => {
    const plan = shareCardPlan({ ...run, note: '#9 of 47' });

    expect(plan.ops.some((op) => op.kind === 'disc')).toBe(false);
    expect(baselineOf(plan, '#9 of 47').color).toBe(
      DEFAULT_SHARE_CARD_PALETTE.text,
    );
  });

  it('keeps a claim of the length the app actually claims on one line', () => {
    // The longest of them is "Мой результат в World Quiz", 26 characters.
    const plan = shareCardPlan({ ...run, claim: "I'm on the leaderboard!" });

    expect(texts(plan.ops)[1]).toBe("I'm on the leaderboard!");
  });

  it('marks a record with the trophy, which an ordinary run has not', () => {
    const trophy = (card: ShareCard) =>
      shareCardPlan(card).ops.find((op) => op.kind === 'glyph');

    expect(trophy({ ...run, tone: 'record' })).toBeDefined();
    expect(trophy(run)).toBeUndefined();
  });

  it("stands a record's medal and figure side by side, under one label", () => {
    const plan = shareCardPlan({
      ...run,
      tone: 'record',
      headline: '4:07.3',
      headlineLabel: 'Time',
      medal: 2,
      note: '#2 of 47',
    });
    const place = baselineOf(plan, '#2');
    const figure = baselineOf(plan, '4:07.3');
    const label = baselineOf(plan, 'Time');

    // The place is read first, then what it was earned with: a row, not a
    // column, so the record's two facts are one object.
    expect(place.x).toBeLessThan(figure.x);
    expect(Math.abs(place.y - figure.y)).toBeLessThan(40);
    // The label sits under its figure, and belongs to it rather than to
    // the medal beside it.
    expect(label.x).toBe(figure.x);
    expect(label.y).toBeGreaterThan(figure.y);
    expect(plan.ops.some((op) => op.kind === 'rule')).toBe(true);
  });

  it('centres a record with no medal, and says nothing about a place', () => {
    const plan = shareCardPlan({
      ...run,
      tone: 'record',
      headline: '21',
      headlineLabel: 'Correct',
      medal: null,
      note: 'First result on this board',
    });

    expect(baselineOf(plan, '21').x).toBe(plan.width / 2);
    expect(plan.ops.some((op) => op.kind === 'rule')).toBe(false);
    expect(texts(plan.ops)).toContain('First result on this board');
  });

  it('keeps both cards quiet: a band at the top, the surface below', () => {
    const plan = shareCardPlan(run);
    const band = plan.ops.find((op) => op.kind === 'band');
    const card = plan.ops.find((op) => op.kind === 'card');

    if (band?.kind !== 'band' || card?.kind !== 'card') {
      throw new Error('the plan draws no card');
    }
    expect(band.height).toBeLessThan(card.height / 3);
    expect(band.fill).toBe(DEFAULT_SHARE_CARD_PALETTE.brand);
    // Only the band's own name is drawn in the colour on the brand; the
    // card under it is the surface, so everything there is ordinary ink.
    expect(baselineOf(plan, 'World Quiz').color).toBe(
      DEFAULT_SHARE_CARD_PALETTE.onBrand,
    );
    expect(baselineOf(plan, 'A flawless run!').color).toBe(
      DEFAULT_SHARE_CARD_PALETTE.text,
    );
    expect(baselineOf(plan, '18 / 20').color).toBe(
      DEFAULT_SHARE_CARD_PALETTE.headline,
    );
    // The invitation is the one thing to act on, so it carries the colour
    // the app gives to what can be pressed.
    expect(baselineOf(plan, 'Beat my result').color).toBe(
      DEFAULT_SHARE_CARD_PALETTE.headline,
    );
  });

  it('invites the reader at the foot of the card, under everything else', () => {
    const plan = shareCardPlan(run);
    const call = baselineOf(plan, 'Beat my result');

    for (const op of plan.ops) {
      if (op.kind !== 'text' || op.text === 'Beat my result') continue;
      expect(op.y).toBeLessThan(call.y);
    }
  });

  it('says nowhere on the picture where the app lives', () => {
    // The invitation is a dare, not an advertisement: a reader who wants to
    // play asks the person who sent it.
    const plan = shareCardPlan(run);

    expect(texts(plan.ops).join(' ')).not.toContain('http');
  });

  it('keeps every word inside the card', () => {
    const plan = shareCardPlan({ ...run, medal: 1, note: '#1 of 12' });
    const card = plan.ops.find((op) => op.kind === 'card');

    if (card?.kind !== 'card') throw new Error('the plan draws no card');
    for (const op of plan.ops) {
      if (op.kind !== 'text') continue;
      // `fillText` is given this width and condenses the text to fit, so a
      // long region name cannot run over the card's edge.
      expect(op.x - op.maxWidth / 2).toBeGreaterThanOrEqual(card.x);
      expect(op.x + op.maxWidth / 2).toBeLessThanOrEqual(card.x + card.width);
      expect(op.y).toBeLessThanOrEqual(card.y + card.height);
      expect(op.y).toBeGreaterThanOrEqual(card.y);
    }
  });

  it('keeps a record inside the card, trophy and medal and all', () => {
    const plan = shareCardPlan({
      ...run,
      tone: 'record',
      headline: '4:07.3',
      headlineLabel: 'Time',
      medal: 1,
      note: '#1 of 2',
    });
    const card = plan.ops.find((op) => op.kind === 'card');

    if (card?.kind !== 'card') throw new Error('the plan draws no record');
    const discs = plan.ops.filter((op) => op.kind === 'disc');
    expect(discs).toHaveLength(2);
    for (const disc of discs) {
      if (disc.kind !== 'disc') continue;
      expect(disc.y - disc.radius).toBeGreaterThanOrEqual(card.y);
      expect(disc.y + disc.radius).toBeLessThanOrEqual(card.y + card.height);
    }
    for (const op of plan.ops) {
      if (op.kind !== 'text') continue;
      expect(op.x - op.maxWidth / 2).toBeGreaterThanOrEqual(card.x);
      expect(op.x + op.maxWidth / 2).toBeLessThanOrEqual(card.x + card.width);
      expect(op.y).toBeLessThanOrEqual(card.y + card.height);
      expect(op.y).toBeGreaterThanOrEqual(card.y);
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
    expect(baselineOf(plan, '18 / 20')).toMatchObject({ color: '#00ff00' });
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
