import type { Route } from '@angular/router';
import { loadQuizRemoteRoutes } from './quiz/remote-routes';
import { provideQuizPorts } from './quiz/quiz-ports.providers';
import { TabsPage } from './tabs/tabs.page';

/**
 * Shell routes.
 *
 * The tab pages are lazy-loaded from the shell bundle. `quiz/capitals` and
 * `quiz/flags` are served by the Capitals and Flags microfrontends:
 * `loadQuizRemoteRoutes` fetches the remote's entry point at navigation time
 * (the URL comes from `public/federation.manifest.json`) and mounts the
 * routes it exposes like any other lazy route. `provideQuizPorts()` is
 * attached to each of these routes, so the remote resolves the shell's
 * implementations of the quiz ports.
 *
 * Sign-in is added in a later phase.
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
  {
    path: 'quiz/setup',
    loadComponent: () =>
      import('./quiz/setup.page').then((m) => m.QuizSetupPage),
  },
  {
    path: 'quiz/capitals',
    providers: [provideQuizPorts()],
    loadChildren: () => loadQuizRemoteRoutes('capitals'),
  },
  {
    path: 'quiz/flags',
    providers: [provideQuizPorts()],
    loadChildren: () => loadQuizRemoteRoutes('flags'),
  },
  { path: '**', redirectTo: 'home' },
];
