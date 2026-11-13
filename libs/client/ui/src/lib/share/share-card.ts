/**
 * The picture a result is shared as.
 *
 * A chat shows a picture, not a line of text, so a finished run and a
 * personal record are drawn as a card: the app's name over the brand
 * gradient, what was played, the score in the size it deserves and two or
 * three figures under it. The address of the deployment is **not** on the
 * picture: a picture of a result is a result, not an advertisement, and the
 * message that travels with the file carries the address anyway.
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

/** One line of figures under the score: "90%" with "Accuracy" beneath it. */
export interface ShareCardStat {
  readonly label: string;
  readonly value: string;
}

/** What a shared picture says. Every string arrives translated. */
export interface ShareCard {
  /** The app's name, in the band at the top. */
  readonly title: string;
  /** What was played: "Capitals · Europe · Easy", or the board's name. */
  readonly subject: string;
  /**
   * A second line under the subject, quieter than it: the mode a run was
   * played in. A board has none — its name already says everything.
   */
  readonly detail?: string | null;
  /** The one figure the picture is about: "18 / 20", or a run's time. */
  readonly headline: string;
  /** Up to three figures under the headline; fewer is fine. */
  readonly stats: readonly ShareCardStat[];
  /** A line between the headline and the figures, e.g. "Perfect run!". */
  readonly note?: string | null;
}

/** The colours the card is drawn in, read from the `--wq-*` tokens. */
export interface ShareCardPalette {
  readonly background: string;
  readonly surface: string;
  readonly border: string;
  readonly brandFrom: string;
  readonly brandTo: string;
  readonly onBrand: string;
  readonly headline: string;
  readonly text: string;
  readonly textSecondary: string;
}

/** The light theme's values, used when no document can be read. */
export const DEFAULT_SHARE_CARD_PALETTE: ShareCardPalette = {
  background: '#f4f5ff',
  surface: '#ffffff',
  border: '#e1e4f5',
  brandFrom: '#4660f5',
  brandTo: '#6b7cff',
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
      readonly from: string;
      readonly to: string;
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

/**
 * Where every word of the picture goes.
 *
 * Text is centred on the card and carries the width it may take, which the
 * painter hands to `fillText`: a long region name is condensed rather than
 * spilling over the edge, and nothing has to be measured here.
 */
export function shareCardPlan(
  card: ShareCard,
  palette: ShareCardPalette = DEFAULT_SHARE_CARD_PALETTE,
): ShareCardPlan {
  const centre = SIZE / 2;
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
      from: palette.brandFrom,
      to: palette.brandTo,
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
    {
      kind: 'text',
      text: card.subject,
      x: centre,
      y: CARD.y + 300,
      size: 42,
      weight: 600,
      color: palette.textSecondary,
      maxWidth: TEXT_WIDTH,
    },
    // The mode is a line of its own rather than a fourth word on the
    // subject: four nouns in a row stop being readable, and the mode says
    // something of a different kind — how the run was played, not what it
    // was about.
    ...(card.detail
      ? [
          {
            kind: 'text' as const,
            text: card.detail,
            x: centre,
            y: CARD.y + 356,
            size: 34,
            weight: 500,
            color: palette.textSecondary,
            maxWidth: TEXT_WIDTH,
          },
        ]
      : []),
    {
      kind: 'text',
      text: card.headline,
      x: centre,
      y: CARD.y + 560,
      size: 150,
      weight: 800,
      color: palette.headline,
      maxWidth: TEXT_WIDTH,
    },
  ];

  if (card.note) {
    ops.push({
      kind: 'text',
      text: card.note,
      x: centre,
      y: CARD.y + 640,
      size: 44,
      weight: 600,
      color: palette.text,
      maxWidth: TEXT_WIDTH,
    });
  }

  // The figures share the card's width evenly, so two sit where two look
  // right and three still have room for their labels.
  const stats = card.stats.slice(0, 3);
  const column = CARD.size / (stats.length || 1);
  stats.forEach((stat, index) => {
    const x = CARD.x + column * (index + 0.5);
    ops.push(
      {
        kind: 'text',
        text: stat.value,
        x,
        y: CARD.y + 810,
        size: 64,
        weight: 700,
        color: palette.text,
        maxWidth: column - 40,
      },
      {
        kind: 'text',
        text: stat.label,
        x,
        y: CARD.y + 867,
        size: 34,
        weight: 500,
        color: palette.textSecondary,
        maxWidth: column - 40,
      },
    );
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
    brandFrom: token('--wq-color-primary', fallback.brandFrom),
    brandTo: token('--wq-color-accent', fallback.brandTo),
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
        const gradient = context.createLinearGradient(
          op.x,
          op.y,
          op.x + op.width,
          op.y + op.height,
        );
        gradient.addColorStop(0, op.from);
        gradient.addColorStop(1, op.to);
        context.fillStyle = gradient;
        context.fillRect(op.x, op.y, op.width, op.height);
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
