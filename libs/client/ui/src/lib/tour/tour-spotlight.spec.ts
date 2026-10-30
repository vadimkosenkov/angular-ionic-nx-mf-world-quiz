import { render } from '@testing-library/angular';
import { spotlightClipPath, TourSpotlight } from './tour-spotlight';
import type { ScreenMeasurement } from './track-rect';

const VIEWPORT = { width: 400, height: 800 };

const at = (
  rect: { left: number; top: number; right: number; bottom: number },
  viewport = VIEWPORT,
): ScreenMeasurement => ({ rect, viewport });

const clipPathOf = (host: HTMLElement) => host.style.clipPath;

describe('spotlightClipPath', () => {
  it('leaves out a rounded rectangle, with room around it', () => {
    const path = spotlightClipPath(
      { left: 100, top: 200, right: 300, bottom: 260 },
      VIEWPORT,
      { x: 10, y: 10 },
      20,
    );

    // The screen is the first subpath, the window the second one.
    expect(path.startsWith('path("M0,0 L400,0 L400,800 L0,800 Z M')).toBe(true);
    // The window starts where its top edge does, past the first corner.
    expect(path).toContain('M110,190 A20,20 0 0 0 90,210');
    expect(path).toContain('L290,270 A20,20 0 0 0 310,250');
  });

  it('keeps a corner against the edge of the screen square', () => {
    const path = spotlightClipPath(
      { left: -40, top: -30, right: 500, bottom: 900 },
      VIEWPORT,
      { x: 10, y: 10 },
      20,
    );

    expect(path).toContain('L400,800');
    expect(path).not.toContain('A');
  });

  it('never rounds more than the window can hold', () => {
    const path = spotlightClipPath(
      { left: 100, top: 200, right: 300, bottom: 220 },
      VIEWPORT,
      { x: 0, y: 0 },
      20,
    );

    // Half the height, or the corners would meet and cross.
    expect(path).toContain('A10,10');
  });

  it('dims everything when the rectangle is off the screen', () => {
    const path = spotlightClipPath(
      { left: 100, top: -400, right: 300, bottom: -340 },
      VIEWPORT,
      { x: 10, y: 10 },
      20,
    );

    expect(path).toBe('none');
  });
});

describe('TourSpotlight', () => {
  it('dims the screen around the step it is given', async () => {
    const { fixture } = await render(TourSpotlight, {
      inputs: {
        hole: at({ left: 16, top: 100, right: 200, bottom: 180 }),
        room: { x: 0, y: 0 },
        radius: 0,
      },
    });

    const host: HTMLElement = fixture.nativeElement;
    expect(clipPathOf(host)).toContain('M16,100');
    expect(clipPathOf(host)).toContain('L200,180');
    // Only a measured layer is shown: an unmeasured one covers everything.
    expect(host.classList.contains('measured')).toBe(true);
    // It is decoration: the tour's words are in the step's card.
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('follows the measurement it is given', async () => {
    const { fixture } = await render(TourSpotlight, {
      inputs: {
        hole: at({ left: 0, top: 400, right: 100, bottom: 450 }),
        room: { x: 0, y: 0 },
        radius: 0,
      },
    });
    expect(clipPathOf(fixture.nativeElement)).toContain('M0,400');

    fixture.componentRef.setInput(
      'hole',
      at({ left: 0, top: 120, right: 100, bottom: 170 }),
    );
    fixture.detectChanges();

    expect(clipPathOf(fixture.nativeElement)).toContain('M0,120');
  });

  it('waits, invisible, while there is nothing to point at', async () => {
    const { fixture } = await render(TourSpotlight, {
      inputs: { hole: null },
    });

    const host: HTMLElement = fixture.nativeElement;
    expect(clipPathOf(host)).toBe('none');
    expect(host.classList.contains('measured')).toBe(false);
  });
});
