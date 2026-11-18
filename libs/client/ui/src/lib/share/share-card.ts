/**
 * The picture a result is shared as.
 *
 * A chat shows a picture, not a line of text, so a finished run and a
 * personal record are drawn as a card. The picture travels **alone**: the
 * share sheet carries the file and nothing else, because a paragraph of the
 * same facts beside it arrives in some apps as a second message and reads
 * like a report. Everything the person who receives it needs is therefore
 * on the card itself.
 *
 * The first line is a **claim** in the player's own voice ("New personal
 * record!", `share-claim.ts`), not a measurement: a picture that leads with
 * "0:34.8" makes the reader hunt for the small print to learn whether that
 * is good. The number is underneath, as what backs the claim up, and the
 * four settings of the run are smaller again. A place in the first three
 * gets its medal, and the foot of the card invites the reader to beat it.
 *
 * Both pictures are the same object: a white card under a band in the
 * app's primary colour. What tells a record from an ordinary run is the
 * **trophy** over the claim and the row underneath it, where the medal and
 * the figure the record was set with stand side by side — the record is
 * about where the player landed, and a run is about how it went.
 *
 * It is **drawn**, not screenshotted. The results card on screen is glass
 * over a blurred backdrop, which the libraries that rasterise the DOM
 * cannot draw at all (and Ionic's components live in shadow roots they do
 * not reach). Drawing it also means the picture is the same everywhere,
 * whatever the phone decided to scroll or scale.
 *
 * The layout is a pure function of the card and the palette
 * (`shareCardPlan`), so what ends up on the picture is tested without a
 * canvas; `paintShareCard` only executes the plan.
 */

/**
 * Transloco's `translate`, as much of it as a card builder needs — the
 * builders live outside their components, and `client/ui` holds no
 * translations of its own.
 */
export type TranslateFn = (
  key: string,
  params?: Record<string, unknown>,
) => string;

/** One figure under the claim: "Accuracy" over "90%", as the app writes it. */
export interface ShareCardStat {
  readonly label: string;
  readonly value: string;
}

/**
 * How loud the card is.
 *
 * `record` adds the trophy and puts the medal beside the figure, the way
 * the app itself celebrates a record; everything else is the quiet card.
 */
export type ShareCardTone = 'record' | 'plain';

/** What a shared picture says. Every string arrives translated. */
export interface ShareCard {
  /** The app's name, in the band at the top. */
  readonly title: string;
  /** The claim the picture leads with: "New personal record!". */
  readonly claim: string;
  /** The one figure that backs the claim: "18 / 20", or a run's time. */
  readonly headline: string;
  /**
   * What that figure is, for a record: "Time" or "Correct", as the results
   * screen labels the same number. A run's headline needs no label — the
   * "18 / 20" says what it is.
   */
  readonly headlineLabel?: string | null;
  /** What was played: "Capitals · Europe · Easy", or the board's name. */
  readonly subject: string;
  /**
   * A second line under the subject, quieter than it: the mode a run was
   * played in. A board has none — its name already says everything.
   */
  readonly detail?: string | null;
  /** The place, as a medal of its own metal, for the first three. */
  readonly medal?: 1 | 2 | 3 | null;
  /**
   * Where the run landed, for a place no medal carries, or a board nobody
   * else is on yet. A medal has the place written on it, so this line is
   * left out whenever one is drawn.
   */
  readonly note?: string | null;
  /** Up to three figures under that; fewer is fine, none is fine. */
  readonly stats: readonly ShareCardStat[];
  /** The invitation at the foot: "Beat my result". */
  readonly callToAction: string;
  readonly tone?: ShareCardTone;
}

/** The colours the card is drawn in, read from the `--wq-*` tokens. */
export interface ShareCardPalette {
  readonly background: string;
  readonly surface: string;
  readonly border: string;
  /** The band at the top and nothing else: `--wq-color-primary`. */
  readonly brand: string;
  readonly onBrand: string;
  /** The primary as **text**: the number of a run, the invitation. */
  readonly headline: string;
  readonly text: string;
  readonly textSecondary: string;
}

/** The light theme's values, used when no document can be read. */
export const DEFAULT_SHARE_CARD_PALETTE: ShareCardPalette = {
  background: '#f4f5ff',
  surface: '#ffffff',
  border: '#e1e4f5',
  brand: '#4660f5',
  onBrand: '#ffffff',
  headline: '#3a52e0',
  text: '#141a3a',
  textSecondary: '#555b7c',
};

/** What the painter draws; a plain list, so the plan can be asserted. */
export type ShareCardOp =
  | { readonly kind: 'fill'; readonly color: string }
  | {
      readonly kind: 'card';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly radius: number;
      readonly fill: string;
      readonly stroke: string;
    }
  | {
      readonly kind: 'band';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly radius: number;
      readonly fill: string;
    }
  | {
      readonly kind: 'disc';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly fill: string;
    }
  | {
      /** A vertical hairline between two figures. */
      readonly kind: 'rule';
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
      readonly color: string;
    }
  | {
      /** An SVG path drawn at a size, centred on its point: the trophy. */
      readonly kind: 'glyph';
      readonly path: string;
      readonly x: number;
      readonly y: number;
      readonly size: number;
      readonly color: string;
    }
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly x: number;
      readonly y: number;
      readonly size: number;
      readonly weight: number;
      readonly color: string;
      readonly maxWidth: number;
    };

export interface ShareCardPlan {
  readonly width: number;
  readonly height: number;
  readonly ops: readonly ShareCardOp[];
}

/** A square: every chat shows it whole, whatever it does with the rest. */
const SIZE = 1080;
const MARGIN = 60;
const CARD = { x: MARGIN, y: MARGIN, size: SIZE - MARGIN * 2 };
const BAND_HEIGHT = 160;
/** Text never runs into the card's rounded corners. */
const TEXT_WIDTH = CARD.size - 100;
/** The foot of the card, where the invitation sits. */
const CALL_TO_ACTION_BASELINE = CARD.y + CARD.size - 56;

/**
 * Ionicons' `trophy`, as a path: a canvas has no icon font, and the mark
 * that says "a record" has to be the one the app shows on screen.
 */
const TROPHY_PATH =
  'M464 80h-60.1a4 4 0 0 1-4-4V63.92a32 32 0 0 0-32-31.92l-223.79.26a32 32 0 0 0-31.94 31.93V76a4 4 0 0 1-4 4H48a16 16 0 0 0-16 16v16c0 54.53 30 112.45 76.52 125.35a7.82 7.82 0 0 1 5.55 5.9c5.77 26.89 23.52 52.5 51.41 73.61 20.91 15.83 45.85 27.5 68.27 32.48a8 8 0 0 1 6.25 7.8V444a4 4 0 0 1-4 4h-59.55c-8.61 0-16 6.62-16.43 15.23A16 16 0 0 0 176 480h159.55c8.61 0 16-6.62 16.43-15.23A16 16 0 0 0 336 448h-60a4 4 0 0 1-4-4v-86.86a8 8 0 0 1 6.25-7.8c22.42-5 47.36-16.65 68.27-32.48 27.89-21.11 45.64-46.72 51.41-73.61a7.82 7.82 0 0 1 5.55-5.9C450 224.45 480 166.53 480 112V96a16 16 0 0 0-16-16M112 198.22a4 4 0 0 1-6 3.45c-10.26-6.11-17.75-15.37-22.14-21.89-11.91-17.69-19-40.67-19.79-63.63a4 4 0 0 1 4-4.15h40a4 4 0 0 1 4 4c-.02 27.45-.07 58.87-.07 82.22m316.13-18.44c-4.39 6.52-11.87 15.78-22.13 21.89a4 4 0 0 1-6-3.46c0-26.51 0-56.63-.05-82.21a4 4 0 0 1 4-4h40a4 4 0 0 1 4 4.15c-.79 22.96-7.9 45.94-19.81 63.63Z';

/**
 * The app's gold (`--wq-color-hint`), which the trophy and every medal are
 * drawn in, with the place written on the disc in white as a medal is
 * engraved.
 *
 * All three places take the same gold rather than a metal of their own:
 * silver and bronze are a grey and a brown disc on a white card, and what
 * the picture is there to say is that the run reached the first three —
 * the number on the disc says which place it was. The gold is fixed rather
 * than read from the theme, because a medal is the same object in either
 * (and `--wq-color-medal-*` are the darkened **text** versions a light page
 * writes a place in).
 */
const GOLD = '#fdbe02';
const MEDAL_FILL = GOLD;
const MEDAL_INK = '#ffffff';
/** The trophy's own disc: the gold at the strength a background takes. */
const GOLD_HALO = 'rgba(253, 190, 2, 0.18)';

const TROPHY_RADIUS = 76;
const MEDAL_RADIUS = 86;
/** The same medal under a run's figures, where the card is fuller. */
const RUN_MEDAL_RADIUS = 62;
/** The row a record ends with: the medal, a hairline, then the figure. */
const RECORD_ROW_HEIGHT = 196;

/**
 * The claim's size, chosen by how long it is.
 *
 * Nothing here measures text — the plan is a pure function and a canvas is
 * not available to it — so the step is counted in characters and the
 * painter's own `maxWidth` condenses whatever still does not fit. Two lines
 * are the most a claim may take; a third would push the number off the
 * middle of the card.
 */
function claimLines(claim: string): {
  readonly lines: readonly string[];
  readonly size: number;
} {
  const words = claim.trim().split(/\s+/);
  // One line for everything the app actually claims -- the longest of them
  // ("Мой результат в World Quiz") is 26 characters, and at 60px that is
  // still inside the card. A claim broken in two for no reason loses the
  // one thing it is there for: being read at a glance.
  if (claim.length <= 22 || words.length === 1) {
    return { lines: [claim], size: claim.length <= 22 ? 76 : 60 };
  }
  if (claim.length <= 28) return { lines: [claim], size: 60 };
  // Break as near the middle as the words allow, so neither line is a stub.
  let best = 1;
  let smallest = Number.POSITIVE_INFINITY;
  for (let at = 1; at < words.length; at += 1) {
    const left = words.slice(0, at).join(' ').length;
    const right = words.slice(at).join(' ').length;
    const difference = Math.abs(left - right);
    if (difference < smallest) {
      smallest = difference;
      best = at;
    }
  }
  return {
    lines: [words.slice(0, best).join(' '), words.slice(best).join(' ')],
    size: claim.length <= 44 ? 52 : 46,
  };
}

/**
 * Where every word of the picture goes.
 *
 * The blocks are measured first and then centred together between the band
 * and the invitation, so a card with no figures has no hole in it and a
 * card with all of them still breathes. Text is centred and carries the
 * width it may take, which the painter hands to `fillText`: a long region
 * name is condensed rather than spilling over the edge.
 */
export function shareCardPlan(
  card: ShareCard,
  palette: ShareCardPalette = DEFAULT_SHARE_CARD_PALETTE,
): ShareCardPlan {
  const centre = SIZE / 2;
  const record = card.tone === 'record';

  const ops: ShareCardOp[] = [
    { kind: 'fill', color: palette.background },
    {
      kind: 'card',
      x: CARD.x,
      y: CARD.y,
      width: CARD.size,
      height: CARD.size,
      radius: 56,
      fill: palette.surface,
      stroke: palette.border,
    },
    {
      kind: 'band',
      x: CARD.x,
      y: CARD.y,
      width: CARD.size,
      height: BAND_HEIGHT,
      radius: 56,
      fill: palette.brand,
    },
    {
      kind: 'text',
      text: card.title,
      x: centre,
      y: CARD.y + 104,
      size: 54,
      weight: 700,
      color: palette.onBrand,
      maxWidth: TEXT_WIDTH,
    },
  ];

  const claim = claimLines(card.claim);
  const stats = card.stats.slice(0, 3);
  const medal = card.medal ?? null;

  /** Each block as [height, how to draw it at a given baseline]. */
  const blocks: readonly {
    readonly height: number;
    readonly draw: (top: number) => void;
  }[] = [
    // The trophy is what says "a record" before a word is read, so it is
    // the first thing under the band.
    ...(record
      ? [
          {
            height: TROPHY_RADIUS * 2 + 24,
            draw: (top: number) => {
              const middle = top + TROPHY_RADIUS + 12;
              ops.push(
                {
                  kind: 'disc',
                  x: centre,
                  y: middle,
                  radius: TROPHY_RADIUS,
                  fill: GOLD_HALO,
                },
                {
                  kind: 'glyph',
                  path: TROPHY_PATH,
                  x: centre,
                  y: middle,
                  size: TROPHY_RADIUS * 1.1,
                  color: GOLD,
                },
              );
            },
          },
        ]
      : []),
    {
      // The air under the claim is the claim's own: without it the subject
      // of a two-line claim sits against its second line.
      height: claim.lines.length * (claim.size + 12) + 24,
      draw: (top) => {
        claim.lines.forEach((line, index) => {
          ops.push({
            kind: 'text',
            text: line,
            x: centre,
            y: top + claim.size + index * (claim.size + 12),
            size: claim.size,
            weight: 800,
            color: palette.text,
            maxWidth: TEXT_WIDTH,
          });
        });
      },
    },
    // A run's figure is the loud thing in the middle of its card; a
    // record's stands in the row below, beside the medal it earned.
    ...(record
      ? []
      : [
          {
            height: 158,
            draw: (top: number) => {
              ops.push({
                kind: 'text',
                text: card.headline,
                x: centre,
                y: top + 130,
                size: 132,
                weight: 800,
                color: palette.headline,
                maxWidth: TEXT_WIDTH,
              });
            },
          },
        ]),
    {
      height: (card.detail ? 92 : 56) + 16,
      draw: (top) => {
        ops.push({
          kind: 'text',
          text: card.subject,
          x: centre,
          y: top + 38,
          size: 38,
          weight: 600,
          color: palette.textSecondary,
          maxWidth: TEXT_WIDTH,
        });
        // The mode is a line of its own rather than a fourth word on the
        // subject: four nouns in a row stop being readable, and the mode
        // says something of a different kind — how the run was played.
        if (card.detail) {
          ops.push({
            kind: 'text',
            text: card.detail,
            x: centre,
            y: top + 84,
            size: 32,
            weight: 500,
            color: palette.textSecondary,
            maxWidth: TEXT_WIDTH,
          });
        }
      },
    },
    ...(record
      ? [
          {
            height: RECORD_ROW_HEIGHT,
            draw: (top: number) => {
              const middle = top + 98;
              const figureX = medal ? CARD.x + 680 : centre;
              if (medal) {
                ops.push(
                  {
                    kind: 'disc',
                    x: CARD.x + 270,
                    y: middle,
                    radius: MEDAL_RADIUS,
                    fill: MEDAL_FILL,
                  },
                  {
                    kind: 'text',
                    text: `#${medal}`,
                    x: CARD.x + 270,
                    y: middle + 33,
                    size: 92,
                    weight: 800,
                    color: MEDAL_INK,
                    maxWidth: MEDAL_RADIUS * 2 - 22,
                  },
                  {
                    kind: 'rule',
                    x: centre - 42,
                    y: middle - 74,
                    width: 4,
                    height: 148,
                    color: palette.border,
                  },
                );
              }
              ops.push({
                kind: 'text',
                text: card.headline,
                x: figureX,
                y: middle + 16,
                size: 108,
                weight: 800,
                color: palette.text,
                maxWidth: medal ? 400 : TEXT_WIDTH,
              });
              // What the figure is, under it rather than over it: the row
              // is read as one object, left to right, and the label is the
              // last thing it needs.
              if (card.headlineLabel) {
                ops.push({
                  kind: 'text',
                  text: card.headlineLabel,
                  x: figureX,
                  y: middle + 76,
                  size: 34,
                  weight: 500,
                  color: palette.textSecondary,
                  maxWidth: medal ? 400 : TEXT_WIDTH,
                });
              }
            },
          },
        ]
      : []),
    ...(!record && medal
      ? [
          {
            height: RUN_MEDAL_RADIUS * 2 + 20,
            draw: (top: number) => {
              ops.push(
                {
                  kind: 'disc',
                  x: centre,
                  y: top + RUN_MEDAL_RADIUS + 10,
                  radius: RUN_MEDAL_RADIUS,
                  fill: MEDAL_FILL,
                },
                {
                  kind: 'text',
                  text: `#${medal}`,
                  x: centre,
                  y: top + RUN_MEDAL_RADIUS + 24,
                  size: 66,
                  weight: 800,
                  color: MEDAL_INK,
                  maxWidth: RUN_MEDAL_RADIUS * 2 - 20,
                },
              );
            },
          },
        ]
      : []),
    ...(card.note && !medal
      ? [
          {
            height: 72,
            draw: (top: number) => {
              ops.push({
                kind: 'text',
                text: card.note as string,
                x: centre,
                y: top + 46,
                size: 42,
                weight: 600,
                color: palette.text,
                maxWidth: TEXT_WIDTH,
              });
            },
          },
        ]
      : []),
    ...(stats.length
      ? [
          {
            height: 130,
            draw: (top: number) => {
              // The figures share the card's width evenly, so two sit where
              // two look right and three still have room for their labels.
              const column = CARD.size / stats.length;
              stats.forEach((stat, index) => {
                const x = CARD.x + column * (index + 0.5);
                ops.push(
                  {
                    kind: 'text',
                    text: stat.label,
                    x,
                    y: top + 36,
                    size: 32,
                    weight: 500,
                    color: palette.textSecondary,
                    maxWidth: column - 40,
                  },
                  {
                    kind: 'text',
                    text: stat.value,
                    x,
                    y: top + 106,
                    size: 62,
                    weight: 700,
                    color: palette.text,
                    maxWidth: column - 40,
                  },
                );
              });
            },
          },
        ]
      : []),
  ];

  const from = CARD.y + BAND_HEIGHT + 24;
  const to = CALL_TO_ACTION_BASELINE - 56;
  const total = blocks.reduce((sum, block) => sum + block.height, 0);
  // The room left over is shared out above and below, but not evenly: the
  // card's name is already at the top, so an even split leaves a hole
  // between it and the claim while the foot looks crowded.
  let cursor = from + Math.max(0, (to - from - total) * 0.38);
  for (const block of blocks) {
    block.draw(cursor);
    cursor += block.height;
  }

  ops.push({
    kind: 'text',
    text: card.callToAction,
    x: centre,
    y: CALL_TO_ACTION_BASELINE,
    size: 40,
    weight: 700,
    // The invitation is the one thing on the card that is an invitation,
    // so it carries the app's own colour.
    color: palette.headline,
    maxWidth: TEXT_WIDTH,
  });

  return { width: SIZE, height: SIZE, ops };
}

/**
 * The palette of the theme the player is looking at, read from the tokens
 * on `<html>`: the picture then matches the app they shared it from. A
 * value the document does not have falls back to the light theme, so a
 * test, a server render or a stylesheet that has not loaded yet still gets
 * a complete palette.
 */
export function readShareCardPalette(
  element: Element | null | undefined = typeof document === 'undefined'
    ? null
    : document.documentElement,
): ShareCardPalette {
  if (!element || typeof getComputedStyle !== 'function') {
    return DEFAULT_SHARE_CARD_PALETTE;
  }
  const style = getComputedStyle(element);
  const token = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  const fallback = DEFAULT_SHARE_CARD_PALETTE;
  return {
    background: token('--wq-color-background', fallback.background),
    surface: token('--wq-color-surface', fallback.surface),
    border: token('--wq-color-border', fallback.border),
    brand: token('--wq-color-primary', fallback.brand),
    onBrand: token('--wq-color-on-primary', fallback.onBrand),
    // Primary-coloured **text**: the plain primary is a fill colour and is
    // only AA against white at this size by luck.
    headline: token('--wq-color-primary-strong', fallback.headline),
    text: token('--wq-color-text-primary', fallback.text),
    textSecondary: token('--wq-color-text-secondary', fallback.textSecondary),
  };
}

/**
 * The app's own font stack. The app loads no web font, so the picture is
 * drawn in the same letters the player is looking at — nothing has to be
 * embedded, and nothing falls back to Times.
 */
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** Executes a plan on a 2D context. Exported for the painter's own tests. */
export function drawShareCard(
  context: CanvasRenderingContext2D,
  plan: ShareCardPlan,
): void {
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  for (const op of plan.ops) {
    switch (op.kind) {
      case 'fill': {
        context.fillStyle = op.color;
        context.fillRect(0, 0, plan.width, plan.height);
        break;
      }
      case 'card': {
        context.beginPath();
        context.roundRect(op.x, op.y, op.width, op.height, op.radius);
        context.fillStyle = op.fill;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = op.stroke;
        context.stroke();
        break;
      }
      case 'band': {
        // The band is the top of the card, so it is clipped to the card's
        // shape: its lower corners are square, its upper ones are not.
        context.save();
        context.beginPath();
        context.roundRect(op.x, op.y, op.width, op.width, op.radius);
        context.clip();
        context.fillStyle = op.fill;
        context.fillRect(op.x, op.y, op.width, op.height);
        context.restore();
        break;
      }
      case 'disc': {
        context.beginPath();
        context.arc(op.x, op.y, op.radius, 0, Math.PI * 2);
        context.fillStyle = op.fill;
        context.fill();
        break;
      }
      case 'rule': {
        context.fillStyle = op.color;
        context.fillRect(op.x, op.y, op.width, op.height);
        break;
      }
      case 'glyph': {
        // An icon font would have to be embedded; the path is the icon.
        if (typeof Path2D !== 'function') break;
        context.save();
        context.translate(op.x - op.size / 2, op.y - op.size / 2);
        context.scale(op.size / 512, op.size / 512);
        context.fillStyle = op.color;
        context.fill(new Path2D(op.path));
        context.restore();
        break;
      }
      case 'text': {
        context.font = `${op.weight} ${op.size}px ${FONT_STACK}`;
        context.fillStyle = op.color;
        context.fillText(op.text, op.x, op.y, op.maxWidth);
        break;
      }
    }
  }
}

/**
 * Draws the card and answers with a PNG — or `null` where there is no
 * canvas to draw on (a server render, a browser that refuses the context).
 * A share that gets `null` goes on without a picture rather than failing.
 */
export async function paintShareCard(
  card: ShareCard,
  palette: ShareCardPalette = readShareCardPalette(),
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const plan = shareCardPlan(card, palette);
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const context = canvas.getContext('2d');
  // `roundRect` is the one recent method used here; without it (an old
  // WebView) the picture is skipped and the text is shared instead.
  if (!context || typeof context.roundRect !== 'function') return null;
  drawShareCard(context, plan);
  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/** The picture as a file for the share sheet; `null` if it cannot be drawn. */
export async function shareCardFile(
  card: ShareCard,
  name = 'world-quiz.png',
  palette?: ShareCardPalette,
): Promise<File | null> {
  const blob = await paintShareCard(card, palette ?? readShareCardPalette());
  if (!blob || typeof File !== 'function') return null;
  return new File([blob], name, { type: 'image/png' });
}
