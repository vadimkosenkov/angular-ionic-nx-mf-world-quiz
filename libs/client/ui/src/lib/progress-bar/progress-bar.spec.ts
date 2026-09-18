import { render, screen } from '@testing-library/angular';
import { ProgressBar } from './progress-bar';

async function renderBar(inputs: {
  value: number;
  max: number;
  valueText?: string;
}) {
  return render(ProgressBar, {
    inputs: { label: 'Europe', valueText: '', ...inputs },
  });
}

describe('ProgressBar', () => {
  it('exposes an accessible progressbar with its values', async () => {
    await renderBar({ value: 3, max: 44, valueText: '3 of 44' });
    const bar = screen.getByRole('progressbar', { name: 'Europe' });

    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('44');
    expect(bar.getAttribute('aria-valuetext')).toBe('3 of 44');
  });

  it.each([
    [0, 195, 0],
    [3, 44, 6.8],
    [44, 44, 100],
    [50, 44, 100], // clamped
    [-5, 44, 0], // clamped
    [0, 0, 0], // empty scale
  ])('value %i of %i fills %s%%', async (value, max, percent) => {
    const { fixture } = await renderBar({ value, max });
    expect(fixture.componentInstance.percent()).toBe(percent);
    const fill = fixture.nativeElement.querySelector('.fill') as HTMLElement;
    expect(fill.style.width).toBe(`${percent}%`);
  });

  it.each(['primary', 'success', 'warning'] as const)(
    'paints the fill with the %s tone',
    async (tone) => {
      const { fixture } = await render(ProgressBar, {
        inputs: { value: 1, max: 2, label: 'Time left', valueText: '', tone },
      });
      const fill = fixture.nativeElement.querySelector('.fill') as HTMLElement;
      expect(fill.classList.contains(tone)).toBe(true);
    },
  );

  it('omits aria-valuetext when none is given', async () => {
    await renderBar({ value: 1, max: 2 });
    expect(screen.getByRole('progressbar').hasAttribute('aria-valuetext')).toBe(
      false,
    );
  });
});
