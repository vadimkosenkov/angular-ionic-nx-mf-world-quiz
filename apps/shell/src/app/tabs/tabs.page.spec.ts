import { render, screen } from '@testing-library/angular';
import { provideShellTesting } from '../../testing/shell-testing';
import { TabsPage } from './tabs.page';

describe('TabsPage', () => {
  it('shows the four main tabs in English', async () => {
    await render(TabsPage, { providers: provideShellTesting() });

    for (const label of ['Home', 'Leaderboard', 'Achievements', 'Settings']) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    expect(
      document.querySelector('ion-tab-bar')?.getAttribute('aria-label'),
    ).toBe('Main navigation');
  });

  it('shows the tabs in Russian', async () => {
    await render(TabsPage, {
      providers: provideShellTesting({ locale: 'ru' }),
    });

    for (const label of ['Главная', 'Рейтинг', 'Достижения', 'Настройки']) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
  });
});
