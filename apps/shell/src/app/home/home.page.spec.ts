import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import type { ManualClock } from '@world-quiz/shared/util';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
import { CLOCK } from '../core/tokens';
import { HomePage } from './home.page';

describe('HomePage', () => {
  it('greets by time of day and shows real totals', async () => {
    await render(HomePage, {
      providers: provideShellTesting({ now: new Date(2026, 8, 17, 20, 30) }),
    });

    expect((await screen.findByTestId('greeting')).textContent?.trim()).toBe(
      'Good evening',
    );
    const overall = screen.getByRole('progressbar', {
      name: 'Overall progress',
    });
    expect(overall.getAttribute('aria-valuetext')).toBe('0 of 390');
    expect(screen.getByTestId('category-capitals').textContent).toContain(
      '195 countries · 6 regions',
    );
    expect(screen.getByTestId('category-flags').textContent).toContain(
      '0/195 mastered',
    );
  });

  it('refreshes the greeting whenever the tab is entered again', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting({ now: new Date(2026, 8, 17, 8, 0) }),
    });
    expect((await screen.findByTestId('greeting')).textContent?.trim()).toBe(
      'Good morning',
    );

    // Ionic keeps the page alive; later the user comes back to the tab.
    (TestBed.inject(CLOCK) as ManualClock).set(
      new Date(2026, 8, 17, 19, 0).getTime(),
    );
    fixture.componentInstance.ionViewWillEnter();
    fixture.detectChanges();

    expect(screen.getByTestId('greeting').textContent?.trim()).toBe(
      'Good evening',
    );
  });

  it('shows the practice empty state, then the number of countries to review', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting(),
    });
    expect((await screen.findByTestId('practice')).textContent).toContain(
      'All clear',
    );

    const progress = TestBed.inject(ProgressStore);
    progress.recordSession(finishedSession([{ code: 'fr', correct: false }]));
    progress.recordSession(
      finishedSession([{ code: 'jp', correct: false }], { category: 'flags' }),
    );
    fixture.detectChanges();

    expect(screen.getByTestId('practice').textContent).toContain(
      '2 countries to review',
    );
  });

  it('uses Russian plural forms', async () => {
    await render(HomePage, {
      providers: provideShellTesting({
        locale: 'ru',
        now: new Date(2026, 8, 17, 8),
      }),
    });

    expect((await screen.findByTestId('greeting')).textContent?.trim()).toBe(
      'Доброе утро',
    );
    expect(screen.getByTestId('category-capitals').textContent).toContain(
      '195 стран · 6 регионов',
    );
  });

  it('opens the quiz setup with the category of the card preselected', async () => {
    await render(HomePage, { providers: provideShellTesting() });

    for (const category of ['capitals', 'flags']) {
      expect(
        (await screen.findByTestId(`play-${category}`)).getAttribute('href'),
      ).toBe(`/quiz/setup?category=${category}`);
    }
  });

  it('previews three achievements with accessible progress', async () => {
    await render(HomePage, { providers: provideShellTesting() });

    const preview = await screen.findByTestId('achievement-preview');
    expect(preview.querySelectorAll('li')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'See all' }).getAttribute('href'),
    ).toBe('/achievements');
  });
});
