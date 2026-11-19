import type { Route } from '@angular/router';
import { signedInGuard, signedOutGuard } from './auth/sign-in.guards';
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
 * Playing needs an account (ADR-011): `/welcome` signs the player in, and
 * everything else is behind `signedInGuard`.
 */
export const appRoutes: Route[] = [
  {
    path: 'welcome',
    canActivate: [signedOutGuard],
    loadComponent: () =>
      import('./welcome/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: '',
    component: TabsPage,
    canActivate: [signedInGuard],
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
    // The reference is opened from Home and pushed over the tabs, like the
    // quiz: it is a place the player goes to read, not a tab to come back to.
    path: 'countries',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./countries/countries.page').then((m) => m.CountriesPage),
  },
  {
    // Opened from Home's Friends card and pushed over the tabs, like the
    // reference: somewhere the player goes to do something and comes back.
    path: 'friends',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./friends/friends.page').then((m) => m.FriendsPage),
  },
  {
    // A friend's own page. The id is bound to the component's `id` input by
    // `withComponentInputBinding()`.
    path: 'friends/:id',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./friends/friend.page').then((m) => m.FriendPage),
  },
  {
    // The other end of an invite link, and the only route besides /welcome
    // that is **not** behind the guard (ADR-011): it shows nothing of the
    // app. It writes the code down and sends the player on — to the friends
    // screen when they are signed in, to the welcome screen when they are
    // not, and the request is sent as soon as there is an account to send
    // it from (invite.page.ts, friends.store.ts).
    path: 'invite/:code',
    loadComponent: () =>
      import('./friends/invite.page').then((m) => m.InvitePage),
  },
  {
    // Reached from the bell on Home and from Settings, and pushed over the
    // tabs like the reference: a page to read, not a tab to come back to.
    path: 'release-notes',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./release-notes/release-notes.page').then(
        (m) => m.ReleaseNotesPage,
      ),
  },
  {
    path: 'quiz/setup',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./quiz/setup.page').then((m) => m.QuizSetupPage),
  },
  {
    path: 'quiz/capitals',
    canActivate: [signedInGuard],
    providers: [provideQuizPorts()],
    loadChildren: () => loadQuizRemoteRoutes('capitals'),
  },
  {
    path: 'quiz/flags',
    canActivate: [signedInGuard],
    providers: [provideQuizPorts()],
    loadChildren: () => loadQuizRemoteRoutes('flags'),
  },
  { path: '**', redirectTo: 'home' },
];
