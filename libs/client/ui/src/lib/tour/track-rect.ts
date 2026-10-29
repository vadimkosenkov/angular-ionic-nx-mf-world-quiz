import { DestroyRef, effect, inject, signal, type Signal } from '@angular/core';

/** A rectangle in viewport coordinates, as `getBoundingClientRect` gives it. */
export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The size of the viewport a rectangle was measured in. */
export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/** Where an element is, and how big the screen was when it was measured. */
export interface ScreenMeasurement {
  readonly rect: ScreenRect;
  readonly viewport: ScreenSize;
}

/**
 * Follows an element around the screen: a signal of where it is now.
 *
 * It measures every frame rather than listening for scroll or resize
 * events. A scroll event is not composed, so it never leaves the shadow
 * root of the element Ionic actually scrolls (the one inside `ion-content`),
 * and a window listener — in the capture phase too — hears nothing at all
 * while the page moves under it.
 *
 * Measuring is one `getBoundingClientRect` per frame, and the signal is only
 * written when a number really changed, so nothing is redrawn while the
 * element stands still. Must be called in an injection context: the loop
 * stops when its owner is destroyed.
 */
export function trackRect(
  target: Signal<HTMLElement | null>,
): Signal<ScreenMeasurement | null> {
  const measurement = signal<ScreenMeasurement | null>(null);

  const measure = () => {
    const element = target();
    if (!element) {
      if (measurement() !== null) measurement.set(null);
      return;
    }
    const { left, top, right, bottom } = element.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const current = measurement();
    if (
      current &&
      current.rect.left === left &&
      current.rect.top === top &&
      current.rect.right === right &&
      current.rect.bottom === bottom &&
      current.viewport.width === width &&
      current.viewport.height === height
    ) {
      return;
    }
    measurement.set({
      rect: { left, top, right, bottom },
      viewport: { width, height },
    });
  };

  // A new element is measured at once, so a step does not have to wait a
  // frame to know where it stands.
  effect(() => {
    target();
    measure();
  });

  let frame = requestAnimationFrame(function follow() {
    measure();
    frame = requestAnimationFrame(follow);
  });
  inject(DestroyRef).onDestroy(() => cancelAnimationFrame(frame));

  return measurement.asReadonly();
}

/**
 * The same measurement, held back while a new element is on its way: `null`
 * from the moment the target changes until it has stood in one place for a
 * frame, and the live measurement after that.
 *
 * A guided tour scrolls the next section into view, and a layer that is
 * placed from a rectangle cannot ride that scroll: the page is moved by the
 * browser and the layer by us, one frame later, which reads as a shiver
 * rather than a slide. So the tour does not travel at all — it hides while
 * the section does, and comes back where the section stopped.
 *
 * Only a change of target starts that wait. A page the player scrolls
 * themselves keeps the tour on its section, frame by frame, where hiding it
 * on every touch would be its own kind of flicker.
 *
 * Must be called in an injection context, and after the `trackRect` it
 * reads: the loop registered later runs later in the same frame, so it sees
 * the measurement of this frame rather than the last one.
 */
export function whenArrived(
  target: Signal<HTMLElement | null>,
  measurement: Signal<ScreenMeasurement | null>,
): Signal<ScreenMeasurement | null> {
  const arrived = signal<ScreenMeasurement | null>(null);
  let watched: HTMLElement | null = null;
  let previous: ScreenMeasurement | null = null;
  let standing = false;

  let frame = requestAnimationFrame(function watch() {
    const element = target();
    const now = measurement();
    if (element !== watched) {
      watched = element;
      standing = false;
    } else if (now !== null && now === previous) {
      // `trackRect` writes a new object only when a number changed, so the
      // same object two frames running means the element has not moved.
      standing = true;
    }
    previous = now;
    arrived.set(standing ? now : null);
    frame = requestAnimationFrame(watch);
  });
  inject(DestroyRef).onDestroy(() => cancelAnimationFrame(frame));

  return arrived.asReadonly();
}
