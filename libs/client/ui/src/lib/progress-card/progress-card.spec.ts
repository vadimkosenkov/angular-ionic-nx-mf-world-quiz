import { render, screen } from '@testing-library/angular';
import { ProgressCard } from './progress-card';

describe('ProgressCard', () => {
  const inputs = {
    heading: 'Overall progress',
    value: 23,
    max: 195,
    valueText: '23 of 195',
    caption: 'Countries mastered',
    detail: '12% complete',
  };

  it('shows the heading, caption and detail, and an accessible progress bar', async () => {
    await render(ProgressCard, { inputs });

    expect(
      screen.getByRole('heading', { name: 'Overall progress' }),
    ).toBeTruthy();
    expect(screen.getByText('Countries mastered')).toBeTruthy();
    expect(screen.getByText('12% complete')).toBeTruthy();
    expect(
      screen
        .getByRole('progressbar', { name: 'Overall progress' })
        .getAttribute('aria-valuetext'),
    ).toBe('23 of 195');
  });

  it('uses the solid style by default and glass on request', async () => {
    const solid = await render(ProgressCard, { inputs });
    expect(solid.fixture.nativeElement.classList.contains('solid')).toBe(true);
    expect(solid.fixture.nativeElement.classList.contains('wq-glass')).toBe(
      false,
    );

    solid.fixture.componentRef.setInput('variant', 'glass');
    solid.fixture.detectChanges();
    expect(solid.fixture.nativeElement.classList.contains('wq-glass')).toBe(
      true,
    );
  });
});
