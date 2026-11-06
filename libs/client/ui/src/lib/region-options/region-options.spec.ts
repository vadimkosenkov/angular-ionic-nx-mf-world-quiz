import { fireEvent, render, screen } from '@testing-library/angular';
import { RegionOptions, type RegionOption } from './region-options';

const options: readonly RegionOption[] = [
  { scope: 'world', name: 'World', count: 195, label: 'World, 195 countries' },
  { scope: 'europe', name: 'Europe', count: 44, label: 'Europe, 44 countries' },
];

const renderOptions = (selected = 'world') =>
  render(RegionOptions, {
    inputs: { options, selected, testId: 'setup-scope' },
  });

describe('RegionOptions', () => {
  it('names every region by what it is, not by the number beside it', async () => {
    await renderOptions();

    const europe = await screen.findByTestId('setup-scope-europe');
    // The visible label carries the count; the accessible name spells it out.
    expect(europe.textContent?.replace(/\s+/g, ' ').trim()).toBe('Europe (44)');
    expect(europe.getAttribute('aria-label')).toBe('Europe, 44 countries');
    expect(
      europe.querySelector('.wq-option-sketch')?.getAttribute('data-region'),
    ).toBe('europe');
  });

  it('says which one is chosen and reports a new choice', async () => {
    const { fixture } = await renderOptions();
    const chosen = vi.fn();
    fixture.componentInstance.chosen.subscribe(chosen);

    expect(
      (await screen.findByTestId('setup-scope-world')).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
    expect(
      screen.getByTestId('setup-scope-europe').getAttribute('aria-pressed'),
    ).toBe('false');

    fireEvent.click(screen.getByTestId('setup-scope-europe'));

    expect(chosen).toHaveBeenCalledWith('europe');
  });

  // Two screens use this list, and their tests tell them apart by id.
  it('takes its test ids from the screen that shows it', async () => {
    await render(RegionOptions, {
      inputs: { options, selected: 'world', testId: 'countries-scope' },
    });

    expect(await screen.findByTestId('countries-scope')).toBeTruthy();
    expect(screen.getByTestId('countries-scope-europe')).toBeTruthy();
  });
});
