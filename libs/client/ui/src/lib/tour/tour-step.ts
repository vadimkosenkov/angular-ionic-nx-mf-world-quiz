import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TOUR_WINDOW_ROOM } from './tour-spotlight';
import type { ScreenMeasurement } from './track-rect';

/**
 * The strip of screen the card may stand in: everything between the
 * floating header and the bottom chrome, in viewport coordinates.
 */
export interface TourCardBand {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Where the card stands inside the band, in pixels from the edges of the
 * screen. Of top and bottom exactly one is set and the other left alone, so
 * the card keeps its own height; `null` everywhere means "wherever the
 * stylesheet puts it", which is where it waits before anything is measured.
 */
export interface TourCardPlacement {
  readonly top: number | null;
  readonly bottom: number | null;
  readonly left: number | null;
  readonly right: number | null;
}

/** The band, and the height of the card that has to fit in it. */
type TourCardFrame = { band: TourCardBand; height: number } | null;

/** Where the page's action normally is, and where the card falls back to. */
const FOOT_OF_THE_SCREEN: TourCardPlacement = {
  top: null,
  bottom: 0,
  left: null,
  right: null,
};

/**
 * The gap between the section and the card: the room the window already
 * leaves around the section, and the same again.
 */
const CARD_GAP = 24;

const clamp = (value: number, limit: number) =>
  Math.max(0, Math.min(value, limit));

/**
 * Puts the card next to the section the step is about: under it when there
 * is room, over it when there is not.
 *
 * Whichever side it takes, the card stays inside the band — out of the top
 * of the screen, where iOS smears anything with a crisp edge (CLAUDE.md),
 * and clear of the bottom chrome. A section too tall for either side leaves
 * the card where the page's action normally is, at the foot of the screen.
 */
export function placeTourCard(
  anchor: ScreenMeasurement | null,
  band: TourCardBand,
  cardHeight: number,
  gap = CARD_GAP,
): TourCardPlacement {
  // Nothing to stand next to, or nothing measured yet.
  if (!anchor || cardHeight <= 0) return FOOT_OF_THE_SCREEN;

  // As wide as the lit window around the same section, down to the pixel:
  // two rectangles of different widths over one section look like a mistake,
  // and on a wide screen a card of its own fixed width looks like a second
  // column.
  const { rect, viewport } = anchor;
  const sides = {
    left: Math.max(0, rect.left - TOUR_WINDOW_ROOM.x),
    right: Math.max(0, viewport.width - rect.right - TOUR_WINDOW_ROOM.x),
  };
  const room = band.bottom - band.top - cardHeight;

  const below = rect.bottom + gap;
  if (below + cardHeight <= band.bottom) {
    return { ...sides, top: clamp(below - band.top, room), bottom: null };
  }

  const above = rect.top - gap;
  if (above - cardHeight >= band.top) {
    return { ...sides, top: null, bottom: clamp(band.bottom - above, room) };
  }
  return { ...sides, top: null, bottom: 0 };
}

/**
 * What the card says: a snapshot of the step's words, so that the words and
 * the place the card stands in change together.
 */
interface TourStepWords {
  readonly text: string;
  readonly step: number;
  readonly progressLabel: string;
  readonly last: boolean;
}

/**
 * One step of a guided tour: the card that says what the player is looking
 * at and moves on to the next thing.
 *
 * A tour is for a screen whose point is easy to miss — the quiz setup, where
 * everything is already chosen and Start is one tap away. The screen is
 * dimmed except the part this step is about (`wq-tour-spotlight`), and this
 * card stands next to that part, so the words and the thing they are about
 * are read in one glance. It also carries the only way forward, which is why
 * it is the one thing on the screen that takes taps: the host element is the
 * band the card is placed in, and lets everything through.
 *
 * It never travels between steps. The card is given the section's place only
 * once the section has arrived (`whenArrived`); until then it is out of
 * sight, and it takes the next step's words while it is, so a step fades out
 * where it was and the next one fades in where it belongs.
 *
 * It is not a message (design-system.md): nobody did anything to cause it.
 * The text is announced as it changes (`aria-live="polite"`) because the
 * card stays and only its contents move on.
 */
@Component({
  selector: 'wq-tour-step',
  imports: [IonIcon],
  template: `
    <div
      class="card"
      data-testid="tour-step"
      [class.placed]="placed()"
      [style.top.px]="placement().top"
      [style.bottom.px]="placement().bottom"
      [style.left.px]="placement().left"
      [style.right.px]="placement().right"
    >
      <span class="bulb" aria-hidden="true">
        <ion-icon name="bulb" />
      </span>
      <p class="text" aria-live="polite" data-testid="tour-text">
        {{ shown().text }}
      </p>
      <button
        type="button"
        class="next"
        data-testid="tour-next"
        (click)="advanced.emit()"
      >
        {{ shown().last ? lastLabel() : nextLabel() }}
      </button>
      <!-- A picture of how far along the tour is: the image role lets the
           dots carry the label that says it in words (a bare div may not). -->
      <div class="dots" role="img" [attr.aria-label]="shown().progressLabel">
        @for (dot of dots(); track dot) {
          <span
            class="dot"
            [class.on]="dot <= shown().step"
            aria-hidden="true"
          ></span>
        }
      </div>
    </div>
  `,
  styleUrl: './tour-step.scss',
})
export class TourStep {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** What this step explains (this library has no translations). */
  readonly text = input.required<string>();
  /** 1-based step number. */
  readonly step = input.required<number>();
  readonly total = input.required<number>();
  /** Translated "Step 2 of 4", for the dots a screen reader cannot read. */
  readonly progressLabel = input.required<string>();
  readonly nextLabel = input.required<string>();
  /** The label of the last step's button ("Got it"). */
  readonly lastLabel = input.required<string>();
  /**
   * The section this step is about, once it has stopped moving; `null` while
   * the page is scrolling it into view.
   */
  readonly anchor = input<ScreenMeasurement | null>(null);

  readonly advanced = output<void>();

  /** The card is shown only where it is meant to stand. */
  protected readonly placed = computed(() => this.anchor() !== null);
  protected readonly dots = computed(() =>
    Array.from({ length: this.total() }, (_, index) => index + 1),
  );

  /**
   * The words on the card. They are taken when the section arrives and kept
   * while it is away, so the next step's text is never read out at the place
   * the last one stood. Untracked for the same reason: the inputs change the
   * moment the step does, which is a little before the card is out of sight.
   */
  protected readonly shown = linkedSignal<
    ScreenMeasurement | null,
    TourStepWords
  >({
    source: this.anchor,
    computation: (anchor, previous) =>
      anchor === null && previous
        ? previous.value
        : untracked(() => ({
            text: this.text(),
            step: this.step(),
            progressLabel: this.progressLabel(),
            last: this.step() >= this.total(),
          })),
  });

  /** How tall the card is, and the band it has to fit in. */
  private readonly frame = signal<TourCardFrame>(null);

  protected readonly placement = linkedSignal<
    { anchor: ScreenMeasurement | null; frame: TourCardFrame },
    TourCardPlacement
  >({
    source: () => ({ anchor: this.anchor(), frame: this.frame() }),
    computation: ({ anchor, frame }, previous) => {
      // Out of sight: it waits where it was rather than sliding to the foot
      // of the screen in the middle of its own fade.
      if (!anchor) return previous?.value ?? FOOT_OF_THE_SCREEN;
      if (!frame) return FOOT_OF_THE_SCREEN;
      return placeTourCard(anchor, frame.band, frame.height);
    },
  });

  constructor() {
    // The card is measured rather than guessed: its height is the text's,
    // which is a different number of lines on every step and every screen.
    afterRenderEffect(() => {
      this.shown();
      this.anchor();
      this.measure();
    });
  }

  private measure(): void {
    const host = this.host.nativeElement;
    const card = host.querySelector('.card');
    if (!card) return;
    const band = host.getBoundingClientRect();
    const { height } = card.getBoundingClientRect();
    const current = this.frame();
    if (
      current &&
      current.height === height &&
      current.band.top === band.top &&
      current.band.bottom === band.bottom
    ) {
      return;
    }
    this.frame.set({ band: { top: band.top, bottom: band.bottom }, height });
  }
}
