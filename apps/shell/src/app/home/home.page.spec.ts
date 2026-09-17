import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { ProgressStore } from '../core/progress.store';
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

  it('shows the practice empty state, then the number of countries to review', async () => {
    const { fixture } = await render(HomePage, {
      providers: provideShellTesting(),
    });
    expect((await screen.findByTestId('practice')).textContent).toContain(
      'All clear',
    );

    TestBed.inject(ProgressStore).record([
      {
        category: 'capitals',
        countryCode: 'fr',
        difficulty: 'easy',
        correct: false,
        answeredAt: 1,
        sessionId: 's',
        sequence: 0,
      },
      {
        category: 'flags',
        countryCode: 'jp',
        difficulty: 'easy',
        correct: false,
        answeredAt: 2,
        sessionId: 's',
        sequence: 1,
      },
    ]);
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

  it('previews three achievements with accessible progress', async () => {
    await render(HomePage, { providers: provideShellTesting() });

    const preview = await screen.findByTestId('achievement-preview');
    expect(preview.querySelectorAll('li')).toHaveLength(3);
    expect(
      screen.getByRole('link', { name: 'See all' }).getAttribute('href'),
    ).toBe('/achievements');
  });
});
