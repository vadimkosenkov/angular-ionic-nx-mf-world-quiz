import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { ProgressStore } from '@world-quiz/client/progress';
import { finishedSession } from '@world-quiz/client/progress/testing';
import { AchievementsPage } from './achievements.page';

describe('AchievementsPage', () => {
  it('lists all 14 achievements as locked, with totals from the dataset', async () => {
    await render(AchievementsPage, { providers: provideShellTesting() });

    expect(
      (await screen.findByTestId('achievements-summary')).textContent,
    ).toContain('0/14 unlocked');
    const list = screen.getByTestId('achievement-list');
    expect(list.querySelectorAll('li')).toHaveLength(14);
    const europe = screen.getByTestId('achievement-capitals-europe-mastered');
    expect(europe.textContent).toContain('Europe · Capitals');
    expect(europe.textContent).toContain('0/44 mastered');
    expect(europe.textContent).toContain('Locked');
  });

  it('shows unlocked achievements with a text status, not only colour', async () => {
    const { fixture } = await render(AchievementsPage, {
      providers: provideShellTesting(),
    });
    await screen.findByTestId('achievement-list');

    const store = TestBed.inject(ProgressStore);
    const southAmerica = store.dataset.filter(
      (c) => c.region === 'south-america',
    );
    // Two correct Hard answers (2 points each) master a country.
    store.recordSession(
      finishedSession(
        southAmerica.flatMap((country) => [
          { code: country.code, correct: true },
          { code: country.code, correct: true },
        ]),
        { category: 'flags', difficulty: 'hard' },
      ),
    );
    fixture.detectChanges();

    const unlocked = screen.getByTestId(
      'achievement-flags-south-america-mastered',
    );
    expect(unlocked.classList.contains('unlocked')).toBe(true);
    expect(unlocked.textContent).toContain('Unlocked');
    expect(
      screen.getByTestId('achievement-flags-world-mastered').textContent,
    ).toContain('In progress');
    expect(screen.getByTestId('achievements-summary').textContent).toContain(
      '1/14 unlocked',
    );
  });
});
