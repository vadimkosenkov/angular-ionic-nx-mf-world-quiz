import { render, screen } from '@testing-library/angular';
import { TourStep } from './tour-step';

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

  it('moves on when the button is pressed', async () => {
    const { fixture } = await renderStep(1);
    const advanced = vi.fn();
    fixture.componentInstance.advanced.subscribe(advanced);

    screen.getByTestId('tour-next').click();

    expect(advanced).toHaveBeenCalledTimes(1);
  });
});
