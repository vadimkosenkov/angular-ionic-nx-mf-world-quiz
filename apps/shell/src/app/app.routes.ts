import type { Route } from '@angular/router';
import { TabsPage } from './tabs/tabs.page';

/**
 * Shell routes. The tab pages are lazy-loaded. Quiz routes (served by the
 * Capitals and Flags microfrontends) and sign-in are added in later phases.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      {
        path: 'leaderboard',
        loadComponent: () =>
          import('./leaderboard/leaderboard.page').then(
            (m) => m.LeaderboardPage,
          ),
      },
      {
        path: 'achievements',
        loadComponent: () =>
          import('./achievements/achievements.page').then(
            (m) => m.AchievementsPage,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./settings/settings.page').then((m) => m.SettingsPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  { path: '**', redirectTo: 'home' },
];
