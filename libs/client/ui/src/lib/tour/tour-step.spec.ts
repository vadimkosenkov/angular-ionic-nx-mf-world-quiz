import { render, screen } from '@testing-library/angular';
import { placeTourCard, TourStep } from './tour-step';
import type { ScreenMeasurement } from './track-rect';

/** A section standing still somewhere on the screen. */
const sectionAt = (top: number): ScreenMeasurement => ({
  rect: { left: 0, top, right: 360, bottom: top + 80 },
  viewport: { width: 400, height: 800 },
});

/** The strip between the floating header and the bottom chrome. */
const BAND = { top: 100, bottom: 760 };
const CARD = 120;

/** A section of the page, as the tour measured it. */
const section = (rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): ScreenMeasurement => ({ rect, viewport: { width: 400, height: 800 } });

const renderStep = (step: number, total = 4) =>
  render(TourStep, {
    inputs: {
      text: 'Start with the quiz type: capitals, or flags.',
      step,
      total,
      progressLabel: `Step ${step} of ${total}`,
      nextLabel: 'Next',
      lastLabel: 'Got it',
    },
  });

describe('TourStep', () => {
  it('says where the player is and what this step is about', async () => {
    await renderStep(2);

    expect(screen.getByTestId('tour-text').textContent).toContain(
      'Start with the quiz type',
    );
    // The dots are decoration; the label is what a screen reader reads.
    expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy();
    expect(screen.getByTestId('tour-text').getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('marks the steps already reached', async () => {
    const { container } = await renderStep(2);

    const dots = container.querySelectorAll('.dot');
    expect(dots).toHaveLength(4);
    expect([...dots].map((dot) => dot.classList.contains('on'))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('offers the next step while there is one', async () => {
    await renderStep(1);
    expect(screen.getByTestId('tour-next').textContent).toContain('Next');
  });

  it('offers the way out on the last step', async () => {
    await renderStep(4);
    expect(screen.getByTestId('tour-next').textContent).toContain('Got it');
  });

  it('stands at the foot of the screen with nothing to stand next to', async () => {
    await renderStep(1);

    const card = screen.getByTestId('tour-step');
    expect(card.style.bottom).toBe('0px');
    expect(card.style.top).toBe('');
  });

  it('waits out of sight until its section has arrived', async () => {
    const { fixture } = await renderStep(1);
    const card = screen.getByTestId('tour-step');
    expect(card.classList.contains('placed')).toBe(false);

    fixture.componentRef.setInput('anchor', sectionAt(200));
    fixture.detectChanges();

    expect(card.classList.contains('placed')).toBe(true);
  });

  it("takes the next step's words only once it is out of sight", async () => {
    const { fixture } = await renderStep(1);
    fixture.componentRef.setInput('anchor', sectionAt(200));
    fixture.detectChanges();

    // The step moves on: the inputs change at once, the card does not —
    // it would otherwise say the next thing where the last one stood.
    fixture.componentRef.setInput('text', 'Now the region.');
    fixture.componentRef.setInput('step', 2);
    fixture.componentRef.setInput('progressLabel', 'Step 2 of 4');
    fixture.detectChanges();
    expect(screen.getByTestId('tour-text').textContent).toContain(
      'Start with the quiz type',
    );

    fixture.componentRef.setInput('anchor', null);
    fixture.detectChanges();
    expect(screen.getByTestId('tour-text').textContent).toContain(
      'Start with the quiz type',
    );

    // It arrives: new words, new place, all at once.
    fixture.componentRef.setInput('anchor', sectionAt(90));
    fixture.detectChanges();
    expect(screen.getByTestId('tour-text').textContent).toContain(
      'Now the region.',
    );
    expect(screen.getByLabelText('Step 2 of 4')).toBeTruthy();
  });

  it('moves on when the button is pressed', async () => {
    const { fixture } = await renderStep(1);
    const advanced = vi.fn();
    fixture.componentInstance.advanced.subscribe(advanced);

    screen.getByTestId('tour-next').click();

    expect(advanced).toHaveBeenCalledTimes(1);
  });
});

describe('placeTourCard', () => {
  it('stands under the section while there is room', () => {
    const placement = placeTourCard(
      section({ left: 0, top: 110, right: 360, bottom: 200 }),
      BAND,
      CARD,
    );

    // Measured from the top of the band, a gap below the section.
    expect(placement).toMatchObject({ top: 124, bottom: null });
  });

  it('stands over the section when there is not', () => {
    const placement = placeTourCard(
      section({ left: 0, top: 500, right: 360, bottom: 700 }),
      BAND,
      CARD,
    );

    expect(placement).toMatchObject({ top: null, bottom: 284 });
  });

  // Two rectangles of different widths over one section look like a mistake.
  it('is exactly as wide as the light around the same section', () => {
    const placement = placeTourCard(
      section({ left: 20, top: 110, right: 380, bottom: 200 }),
      BAND,
      CARD,
    );

    // The same room at the sides that `spotlightClipPath` leaves.
    expect(placement).toMatchObject({ left: 12, right: 12 });
  });

  it('falls back to the foot of the screen for a section with neither', () => {
    const placement = placeTourCard(
      section({ left: 0, top: 150, right: 360, bottom: 740 }),
      BAND,
      CARD,
    );

    expect(placement).toMatchObject({ top: null, bottom: 0 });
  });

  it('waits where the stylesheet puts it until something has been measured', () => {
    const unmeasured = { top: null, bottom: 0, left: null, right: null };
    expect(placeTourCard(null, BAND, CARD)).toEqual(unmeasured);
    expect(
      placeTourCard(
        section({ left: 0, top: 110, right: 360, bottom: 200 }),
        BAND,
        0,
      ),
    ).toEqual(unmeasured);
  });

  it('keeps the card inside the band whatever it is given', () => {
    // A section below the screen: the card stays where it can be read.
    const placement = placeTourCard(
      section({ left: 0, top: 1200, right: 360, bottom: 1400 }),
      BAND,
      CARD,
    );

    expect(placement.bottom).toBeGreaterThanOrEqual(0);
    expect(placement.bottom).toBeLessThanOrEqual(BAND.bottom - BAND.top - CARD);
  });
});
