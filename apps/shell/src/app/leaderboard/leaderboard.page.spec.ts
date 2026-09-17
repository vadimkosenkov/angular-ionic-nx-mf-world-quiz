import { render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { LeaderboardPage } from './leaderboard.page';

describe('LeaderboardPage', () => {
  it('shows the four perfect-run boards and the rules with the real country count', async () => {
    await render(LeaderboardPage, { providers: provideShellTesting() });

    for (const board of [
      'Capitals · Easy',
      'Capitals · Hard',
      'Flags · Easy',
      'Flags · Hard',
    ]) {
      expect(await screen.findByText(board)).toBeTruthy();
    }
    expect(screen.getByTestId('leaderboard-rules').textContent).toContain(
      'Answer all 195 countries correctly',
    );
  });

  it('is honest that rankings are not available yet, in both views', async () => {
    const { fixture } = await render(LeaderboardPage, {
      providers: provideShellTesting(),
    });
    const unavailable = await screen.findByTestId('leaderboard-unavailable');
    expect(unavailable.textContent).toContain('Leaderboards are on their way');
    expect(unavailable.getAttribute('role')).toBe('status');

    screen
      .getByTestId('leaderboard-view')
      .dispatchEvent(
        new CustomEvent('ionChange', { detail: { value: 'mine' } }),
      );
    fixture.detectChanges();
    expect(screen.getByText('My records')).toBeTruthy();
    expect(screen.getByTestId('leaderboard-unavailable').textContent).toContain(
      'Leaderboards are on their way',
    );
  });

  it('only accepts known views and boards from segment events', async () => {
    const { fixture } = await render(LeaderboardPage, {
      providers: provideShellTesting(),
    });
    const page = fixture.componentInstance as unknown as {
      view: () => string;
      board: () => string;
    };
    const emit = (testId: string, value: unknown) =>
      screen
        .getByTestId(testId)
        .dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
    await screen.findByTestId('leaderboard-view');

    emit('leaderboard-view', 'mine');
    emit('leaderboard-board', 'flags-hard');
    expect(page.view()).toBe('mine');
    expect(page.board()).toBe('flags-hard');

    emit('leaderboard-view', 'friends');
    emit('leaderboard-board', 'flags-timed');
    emit('leaderboard-board', undefined);
    expect(page.view()).toBe('mine');
    expect(page.board()).toBe('flags-hard');
  });
});
