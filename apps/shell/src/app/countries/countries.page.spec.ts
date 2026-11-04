import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
import { provideShellTesting } from '../../testing/shell-testing';
import { CountriesPage } from './countries.page';

/** Switching the region filter: one block per region, as the setup has. */
function chooseRegion(region: string): void {
  screen.getByTestId(`countries-scope-${region}`).click();
}

describe('CountriesPage', () => {
  it('lists every country with its capital and its flag', async () => {
    await render(CountriesPage, { providers: provideShellTesting() });

    const list = await screen.findByTestId('country-list');
    expect(list.querySelectorAll('li')).toHaveLength(195);

    const france = screen.getByTestId('country-fr');
    expect(france.textContent).toContain('France');
    expect(france.textContent).toContain('Paris');
    expect(france.querySelector('img')?.getAttribute('src')).toBe(
      'flags/fr.svg',
    );
  });

  it('filters by region and sorts by name, not by the dataset order', async () => {
    const { fixture } = await render(CountriesPage, {
      providers: provideShellTesting(),
    });
    await screen.findByTestId('country-list');

    chooseRegion('oceania');
    fixture.detectChanges();

    const names = [...screen.getByTestId('country-list').querySelectorAll('li')]
      .map((row) => row.querySelector('.name')?.textContent?.trim())
      .filter((name): name is string => name !== undefined);
    expect(names).toHaveLength(14);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain('Australia');
    expect(names).not.toContain('France');
  });

  it('lights each fact on its own, because mastery is per category', async () => {
    const { fixture } = await render(CountriesPage, {
      providers: provideShellTesting(),
    });
    await screen.findByTestId('country-list');

    const store = TestBed.inject(ProgressStore);
    // Two correct Hard answers (2 points each) master a country.
    store.recordSession(
      finishedSession(
        [
          { code: 'fr', correct: true },
          { code: 'fr', correct: true },
          { code: 'de', correct: false },
        ],
        { category: 'capitals', difficulty: 'hard' },
      ),
    );
    fixture.detectChanges();

    const capitalOfFrance = screen.getByTestId('mark-capitals-fr');
    expect(capitalOfFrance.classList).toContain('mastered');
    expect(capitalOfFrance.textContent).toContain('Capital: mastered');

    // The flag of the same country was never asked for, and a country
    // answered wrong is not mastered either: both stay plain.
    const flagOfFrance = screen.getByTestId('mark-flags-fr');
    expect(flagOfFrance.classList).not.toContain('mastered');
    expect(screen.getByTestId('country-fr').textContent).toContain(
      'Flag: not mastered yet',
    );

    const capitalOfGermany = screen.getByTestId('mark-capitals-de');
    expect(capitalOfGermany.classList).not.toContain('mastered');
    expect(capitalOfGermany.textContent).toContain('Capital: not mastered yet');
  });
});
