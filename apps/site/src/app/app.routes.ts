import type { Route, UrlSegment } from '@angular/router';
import { isLeaderboardBoardId } from '@world-quiz/quiz/domain';
import { isSiteLanguage } from './i18n/site-language';
import { SiteLayout } from './layout/site-layout';

/** `canMatch` for the `:lang` segment: only the site's languages. */
const languageMatches = (_route: Route, segments: UrlSegment[]) =>
  isSiteLanguage(segments[0]?.path);

/** `canMatch` for `leaderboard/:board`: only the four boards. */
const boardMatches = (_route: Route, segments: UrlSegment[]) =>
  isLeaderboardBoardId(segments[1]?.path);

/**
 * Every page lives under its language: `/en/…` and `/ru/…`. The server
 * redirects `/` by `Accept-Language` (server.ts); in the browser it falls
 * back to English.
 */
export const siteRoutes: Route[] = [
  {
    path: ':lang',
    canMatch: [languageMatches],
    component: SiteLayout,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/home.page').then((m) => m.HomePage),
      },
      {
        path: 'leaderboard',
        pathMatch: 'full',
        redirectTo: 'leaderboard/capitals-easy',
      },
      {
        path: 'leaderboard/:board',
        canMatch: [boardMatches],
        loadComponent: () =>
          import('./pages/leaderboard.page').then((m) => m.LeaderboardPage),
      },
      {
        path: 'privacy',
        data: { doc: 'privacy' },
        loadComponent: () =>
          import('./pages/legal.page').then((m) => m.LegalPage),
      },
      {
        path: 'terms',
        data: { doc: 'terms' },
        loadComponent: () =>
          import('./pages/legal.page').then((m) => m.LegalPage),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./pages/not-found.page').then((m) => m.NotFoundPage),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'en' },
  { path: '**', redirectTo: 'en' },
];
