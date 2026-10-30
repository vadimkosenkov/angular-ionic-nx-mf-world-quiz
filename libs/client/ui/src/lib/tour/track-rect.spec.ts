import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { trackRect, whenArrived } from './track-rect';
import type { ScreenMeasurement } from './track-rect';

/** An element that reports where the test says it is. */
function sectionAt(top: number): {
  element: HTMLElement;
  move(to: number): void;
} {
  let current = top;
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({
      left: 0,
      top: current,
      right: 100,
      bottom: current + 50,
      x: 0,
      y: current,
      width: 100,
      height: 50,
    }) as DOMRect;
  return { element, move: (to: number) => (current = to) };
}

/** Lets the loop measure again. */
const nextFrame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => setTimeout(resolve)),
  );

describe('trackRect', () => {
  it('reports where the element is, and how big the screen is', async () => {
    const section = sectionAt(400);
    const measurement = TestBed.runInInjectionContext(() =>
      trackRect(signal(section.element)),
    );

    await nextFrame();

    expect(measurement()?.rect).toEqual({
      left: 0,
      top: 400,
      right: 100,
      bottom: 450,
    });
    expect(measurement()?.viewport).toEqual({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  });

  it('follows the element when the page scrolls', async () => {
    const section = sectionAt(400);
    const measurement = TestBed.runInInjectionContext(() =>
      trackRect(signal(section.element)),
    );
    await nextFrame();

    // Nothing announces this: a scroll event does not leave the shadow root
    // of the element Ionic scrolls, so the rectangle is measured every frame.
    section.move(120);
    await nextFrame();

    expect(measurement()?.rect.top).toBe(120);
  });

  it('has nothing to report without an element', async () => {
    const measurement = TestBed.runInInjectionContext(() =>
      trackRect(signal(null)),
    );

    await nextFrame();

    expect(measurement()).toBeNull();
  });
});

describe('whenArrived', () => {
  const at = (top: number): ScreenMeasurement => ({
    rect: { left: 0, top, right: 100, bottom: top + 50 },
    viewport: { width: 400, height: 800 },
  });

  it('reports nothing until the element has stood still for a frame', async () => {
    const target = signal<HTMLElement | null>(document.createElement('div'));
    const live = signal<ScreenMeasurement | null>(at(400));
    const arrived = TestBed.runInInjectionContext(() =>
      whenArrived(target, live),
    );

    expect(arrived()).toBeNull();
    await nextFrame();
    expect(arrived()).toBeNull();

    await nextFrame();
    expect(arrived()).toEqual(at(400));
  });

  it('goes away while a new element is on its way, and comes back where it stops', async () => {
    const first = document.createElement('div');
    const target = signal<HTMLElement | null>(first);
    const live = signal<ScreenMeasurement | null>(at(400));
    const arrived = TestBed.runInInjectionContext(() =>
      whenArrived(target, live),
    );
    await nextFrame();
    await nextFrame();
    expect(arrived()).not.toBeNull();

    // The step moves on: a new section, scrolled into view over a few frames.
    target.set(document.createElement('div'));
    live.set(at(600));
    await nextFrame();
    expect(arrived()).toBeNull();

    live.set(at(300));
    await nextFrame();
    expect(arrived()).toBeNull();

    // It has stopped: the same measurement two frames running.
    await nextFrame();
    expect(arrived()).toEqual(at(300));
  });

  it('keeps following the section a player scrolls themselves', async () => {
    const target = signal<HTMLElement | null>(document.createElement('div'));
    const live = signal<ScreenMeasurement | null>(at(400));
    const arrived = TestBed.runInInjectionContext(() =>
      whenArrived(target, live),
    );
    await nextFrame();
    await nextFrame();

    // Same element, moving under the finger: hiding the tour on every touch
    // would be its own flicker, so it holds on to the section.
    live.set(at(380));
    await nextFrame();

    expect(arrived()).toEqual(at(380));
  });
});
