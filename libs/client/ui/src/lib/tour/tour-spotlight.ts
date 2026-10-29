import { Component, computed, input, linkedSignal } from '@angular/core';
import type { ScreenMeasurement, ScreenRect, ScreenSize } from './track-rect';

/** Dims everything: nothing is clipped away, so there is no window. */
const NO_WINDOW = 'none';

/**
 * The room the light leaves around the step's section.
 *
 * Narrower at the sides than above and below, and for a reason: the section
 * is already inset by the page's gutter, so the sides of the window land on
 * the column the tour's card takes (`placeTourCard` uses `x` for the same
 * thing). The two are then exactly as wide as each other, whatever the
 * screen — which is the point of measuring one rectangle for both.
 */
export const TOUR_WINDOW_ROOM = { x: 8, y: 12 } as const;

/** How much room the light leaves around a section, per axis. */
export interface TourWindowRoom {
  readonly x: number;
  readonly y: number;
}

/** Rounds a corner the short way round; a radius of zero keeps it square. */
const corner = (radius: number, x: number, y: number) =>
  radius > 0 ? `A${radius},${radius} 0 0 0 ${x},${y}` : `L${x},${y}`;

/**
 * The clip path of a dimming layer with one rounded window in it.
 *
 * The window is a second subpath wound the opposite way round, which the
 * default (nonzero) fill rule leaves out of the shape. `path()` is what
 * allows the corners to be round at all — `polygon()` has only straight
 * lines — and it keeps the shape to one subpath per ring, with no seam
 * between them. Its coordinates are plain pixels in the layer's own box,
 * which is the viewport, so the size of the screen is part of the path and
 * the layer is redrawn when it changes.
 *
 * The second `M` of the path is always the top edge of the window: the
 * tests read it to say which section the light falls on.
 */
export function spotlightClipPath(
  hole: ScreenRect,
  viewport: ScreenSize,
  room: TourWindowRoom,
  radius: number,
): string {
  const left = Math.max(0, hole.left - room.x);
  const top = Math.max(0, hole.top - room.y);
  const right = Math.min(viewport.width, hole.right + room.x);
  const bottom = Math.min(viewport.height, hole.bottom + room.y);
  // Scrolled out of sight, or never measured: nothing to leave out.
  if (right <= left || bottom <= top) return NO_WINDOW;

  const round = Math.min(radius, (right - left) / 2, (bottom - top) / 2);
  // A corner held against the edge of the screen is not a corner of the
  // window: rounding it there would bite a piece out of the screen itself.
  const upper = top > 0 ? round : 0;
  const lower = bottom < viewport.height ? round : 0;

  const screen = `M0,0 L${viewport.width},0 L${viewport.width},${viewport.height} L0,${viewport.height} Z`;
  const lit = [
    `M${left + upper},${top}`,
    corner(upper, left, top + upper),
    `L${left},${bottom - lower}`,
    corner(lower, left + lower, bottom),
    `L${right - lower},${bottom}`,
    corner(lower, right, bottom - lower),
    `L${right},${top + upper}`,
    corner(upper, right - upper, top),
    'Z',
  ].join(' ');
  return `path("${screen} ${lit}")`;
}

/**
 * The dimming layer of a guided tour: the whole screen except the part the
 * step is about.
 *
 * It replaced a blur on every other section, which said "these are out of
 * focus" rather than "this one". A window also leaves the step's own section
 * untouched — its real colours, its real contrast — and, because a clip
 * path takes the window out of hit testing too, still reachable by a finger
 * while everything around it is not.
 *
 * The layer sits below the floating page header on purpose: the way off the
 * screen stays lit and usable while the tour runs.
 *
 * Where its section is is measured by whoever owns the tour (`trackRect`),
 * because the step's card follows the same section and one measurement
 * serves both. There is no transition on the clip path: the window moves
 * with the page under it, frame by frame, and a transition would make it
 * trail behind the scroll instead of holding on to the section.
 *
 * Between two steps there is nothing to point at (`whenArrived` reports
 * `null` while the next section is scrolling into view), and the screen is
 * simply dim all over until it arrives. The dimming itself stays: it fades
 * in once, when the tour starts, and off again only when the tour ends with
 * the layer.
 */
@Component({
  selector: 'wq-tour-spotlight',
  template: '',
  styleUrl: './tour-spotlight.scss',
  host: {
    'aria-hidden': 'true',
    '[class.measured]': 'measured()',
    '[style.clip-path]': 'clipPath()',
  },
})
export class TourSpotlight {
  /** Where to leave the light on; everything around it is dimmed. */
  readonly hole = input.required<ScreenMeasurement | null>();
  /** How much room to leave around it, per axis. */
  readonly room = input<TourWindowRoom>(TOUR_WINDOW_ROOM);
  /** The window's corners, as round as a card's (`--wq-radius-lg`). */
  readonly radius = input(24);

  /**
   * Whether the layer has ever had a window in it. Until the first
   * measurement it would cover the whole screen, the step's section
   * included, so it waits out of sight and fades in with the hole already
   * there; after that it stays, window or no window.
   */
  protected readonly measured = linkedSignal<ScreenMeasurement | null, boolean>(
    {
      source: this.hole,
      computation: (hole, previous) =>
        previous?.value === true || hole !== null,
    },
  );

  protected readonly clipPath = computed(() => {
    const hole = this.hole();
    if (!hole) return NO_WINDOW;
    return spotlightClipPath(
      hole.rect,
      hole.viewport,
      this.room(),
      this.radius(),
    );
  });
}
