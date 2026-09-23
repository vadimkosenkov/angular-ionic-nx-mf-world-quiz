# Frontend (shell)

> Status: **implemented**: Ionic shell, navigation, Home, Leaderboard,
> Achievements, Settings (Phase 3); quiz setup and the Capitals (Phase 4)
> and Flags (Phase 5) quizzes, each loaded from its own microfrontend;
> sign-in with Google (Phase 7b), required before playing, with progress kept
> on the device and synced with the account (Phase 8b); leaderboard
> challenges, rankings, records and the public nickname (Phase 9b).

## Stack

- **Angular 22:** standalone components, **zoneless** change detection,
  OnPush by default, signals, `input()`, `@if`/`@for`/`@let`.
- **Ionic 9** in iOS mode (`provideIonicAngular({ mode: 'ios' })`),
  standalone imports from `@ionic/angular`.
- **Transloco** for runtime English/Russian ([i18n.md](i18n.md)).
- **Capacitor Preferences** for settings storage (works on the web through `localStorage`).

## Structure

```
apps/shell/src/app/
  app.config.ts        providers: Ionic, router, i18n, settings, auth, progress, icons
  app.routes.ts        welcome, tabs + lazy pages, guards
  welcome/             first screen: what the app is, sign in
  auth/                signedInGuard / signedOutGuard, back to welcome when a sign-in ends
  app.ts               <ion-app><ion-router-outlet/></ion-app>
  tabs/                ion-tabs with a translucent tab bar
  home/                greeting, overall progress, categories, practice, achievement preview
  leaderboard/         challenge start, global ranking per board, my records
  achievements/        summary, legend, all 14 achievements
  settings/            account (sign-in), theme, language, about
  quiz/
    setup.page.*       category, region, difficulty and mode; starts the quiz
    quiz-ports.providers.ts  the shell's side of the microfrontend contract
    remote-routes.ts   loads a remote's routes, with a fallback when it fails
    remote-unavailable.page.ts
  core/
    tokens.ts          COUNTRY_DATASET, CLOCK
    greeting.ts        time-of-day greeting rule
  icons.ts             explicit ionicons registration
  app-info.ts          version shown in Settings
apps/shell/src/testing/ shared test providers (not in the app build)
```

Libraries used by the shell:

| Library                          | Role                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `client-ui`                      | Tokens, themes, glass, `wq-progress-bar`, `wq-progress-card`, `wq-empty-state` |
| `client-quiz-ports`              | Tokens and interfaces the shell and the remotes share                          |
| `client-quiz-feature`            | The quiz screens themselves (`wq-quiz-play`, `wq-quiz-results`)                |
| `client-auth`                    | `AuthStore`, API calls for sign-in, bearer interceptor, Google button (GIS)    |
| `client-progress`                | `ProgressStore` (IndexedDB via Dexie), outbox, `SyncService`                   |
| `client-i18n`                    | Transloco setup, bundled translations, `wqPlural`, locale detection            |
| `client-settings`                | `SettingsStore`, storage port, system colour-scheme signal, document sync      |
| `quiz-domain` / `quiz-countries` | Progress, achievements and all counts come from the domain and the dataset     |

## Routing

| URL                                                                        | Page                                                  | Loading                               |
| -------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------- |
| `/welcome`                                                                 | welcome + sign-in (`signedOutGuard`: players go home) | lazy (`loadComponent`)                |
| `/`                                                                        | redirect to `/home`                                   | —                                     |
| `/home`, `/leaderboard`, `/achievements`, `/settings`                      | tab pages inside `TabsPage`                           | lazy (`loadComponent`)                |
| `/quiz/setup`                                                              | quiz setup (shell)                                    | lazy (`loadComponent`)                |
| `/quiz/setup?category=`                                                    | preselects Capitals or Flags (Home's cards link here) | —                                     |
| `/quiz/capitals?scope=&difficulty=&mode=&count=`                           | Capitals microfrontend                                | `loadChildren` over Native Federation |
| `/quiz/flags?scope=&difficulty=&mode=&count=`                              | Flags microfrontend                                   | `loadChildren` over Native Federation |
| `/quiz/<category>?mode=challenge&difficulty=&scope=world&challenge=&seed=` | a leaderboard challenge (started from Leaderboard)    | same remotes                          |
| anything else                                                              | redirect to `/home`                                   | —                                     |

Everything except `/welcome` is behind `signedInGuard`
([ADR-011](../decisions/ADR-011-sign-in-required.md)): it waits for the
start-up restore, lets in a signed-in player (claiming the device's data for
them) or, offline, the player who owns the device's data, and sends anyone
else to `/welcome`. All URLs are deep-linkable, including a quiz with its
options (tested in Cypress). How the federated route is wired, and what the shell and the remote
may know about each other, is described in
[microfrontends.md](microfrontends.md).

## Sign-in (welcome screen, Settings → Account)

`libs/client/auth` (design: [ADR-010](../decisions/ADR-010-authentication.md)):

- **Start-up**: `provideAuth()` restores a previous sign-in with the httpOnly
  refresh cookie, without blocking the first render (status `restoring` →
  `signed-in` or `signed-out`; `unverified` when the API cannot be reached —
  the section says so, offers "Try again" and checks again when the browser
  is back online).
- **Welcome screen** (`/welcome`): app name, real counts from the dataset
  (countries, regions, training modes) and Google's button; its ID token and
  our nonce go to `POST /v1/auth/google`, then the device's data is claimed
  for the player and the app opens on Home. **Apple** is shown as coming with
  the iPhone app — web Sign in with Apple needs a registered HTTPS domain.
- **When a sign-in ends** (sign-out, deletion, refresh refused),
  `provideSignInFlow()` returns to `/welcome` with a new navigation root.
- **Google's button is Google's page** (an iframe): a white "Sign in with
  Google" in both themes (black is left to Apple), drawn again when the
  language changes. Its shape, font and padding
  are Google's, and Google may show it in the language of the Google account
  signed in to the browser instead of the app's `hl`. Known limitation, with
  a TODO in `google-sign-in-button.ts`: a custom button with an OpenID Connect
  popup would give full control.
- **Tokens**: the access token only in memory, the refresh token only in the
  httpOnly cookie; nothing in `localStorage`. `authInterceptor` adds the
  bearer token to API requests and renews it once, shared, on 401; tabs take
  turns through a Web Lock. Only the API's refusal (401 from
  `/v1/auth/refresh`) signs the player out; offline, 5xx or 429 do not.
- **Settings → Account** shows the player, whether their results are saved
  (all saved / N waiting / offline, retried automatically / N refused by the
  server), sign-out and account deletion.
- **Sign-out** tries to send pending results first; if some are still
  unsent, it asks — with the number — before deleting them with the rest of
  the device's data. **Account deletion** asks inline, with the consequence
  spelled out, before `DELETE /v1/me`, then clears the device too.
- The API URL and the Google client id are **not compiled in**: the app reads
  them from `config.json` before it starts
  (`apps/shell/src/app/runtime-config.ts`, [ADR-012](../decisions/ADR-012-environments.md)),
  and a deployment replaces that file together with
  `federation.manifest.json`. `apps/shell/public/config.json` holds the
  development values.
- Progress and sync: [state-management.md](state-management.md) and
  [ADR-006](../decisions/ADR-006-local-persistence.md).

## Leaderboard (challenges, rankings, records)

Rules: [leaderboard.md](../domain/leaderboard.md).

- **Global**: the board chosen (four boards), with a card that starts a
  challenge on it: `POST /v1/challenges`, then the board's quiz opens with
  the challenge id and the server's seed in the URL. Below, the ranking
  (`httpResource` on `GET /v1/leaderboards/:board`): rank, nickname, time
  (`m:ss.t`), the player's own row marked (`aria-current`, from their
  records), and the number of players. Loading, error with retry and empty
  states are explicit.
- **My records**: every board with the player's best time and place
  (`GET /v1/me/records`), or "No perfect run yet".
- Both are loaded again when the tab is shown and **after every sync**
  (`SyncService.lastSyncedAt`): Ionic can show this cached page again without
  `ionViewWillEnter`, e.g. after "New challenge" on the results.
- **Results of a challenge** (in the remote): "Checking your run…", then
  "Ranked #N", the time and "New personal record!", or why the run is not
  ranked, or that it could not be sent (offline). "Play again" becomes "New
  challenge" and returns to the leaderboard: a challenge is played once.
- **Public name**: Settings → Account shows the nickname and edits it inline,
  validated with the API's own `nicknameSchema` before sending (`PATCH
/v1/me` through `AuthStore.setNickname`).

## Start-up sequence

1. `provideAppSettings()` registers an **app initializer**:
   - load settings from storage;
   - load the translation file for the stored (or device) language;
   - start `DocumentSettingsSync`.
2. Only then does Angular render, so there is no flash of the wrong theme or of untranslated keys.
3. `DocumentSettingsSync` keeps `<html class="ion-palette-dark">`,
   `color-scheme`, `<html lang>` and the active Transloco language in sync with
   the store for the rest of the session.

## Data shown on screens

Everything is derived; nothing is copied from the Figma mock-ups:

- **Country and region counts** (195, 6) come from the dataset.
- **Overall progress** is Capitals + Flags mastered, out of 2 × 195.
- **Achievements** (14) come from `evaluateAchievements`, with per-scope totals from the dataset.
- **Practice Mistakes** comes from `practiceCandidates`.
- **Leaderboard** shows real rankings and records from the API.

`ProgressStore` (`client-progress`) keeps the finished sessions on the device
(IndexedDB) and rebuilds progress from their answers. The shell's quiz result
sink calls `ProgressStore.recordSession(session)` after each finished
session and asks `SyncService` to send it.

## Bundle size

Native Federation changes how this is measured: the entry point only starts
federation, and nearly everything — including Angular, Ionic and the workspace
libraries — is loaded as **shared ES modules through a generated import map**.
The builder's "initial" number therefore no longer equals what the browser
fetches for the first paint.

Production build (Phase 4):

|                                                           | Raw        | Transferred (est.) |
| --------------------------------------------------------- | ---------- | ------------------ |
| Shell entry (`main` + polyfills)                          | ≈ 46 kB    | ≈ 15 kB            |
| Shared framework module (Angular + Ionic), loaded at once | ≈ 710 kB   | ≈ 150 kB           |
| Each tab page                                             | 3–10 kB    | 1–3 kB             |
| Each translation file                                     | 2.5–3.5 kB | ≈ 1 kB             |
| Capitals remote's own code (loaded when a quiz starts)    | ≈ 8 kB     | ≈ 3 kB             |

The remote is that small because the host and the remote **share the workspace
libraries too**: `@world-quiz/quiz/domain`, `quiz/countries`, `client/ui`,
`client/i18n`, `client/settings`, `client/quiz-ports` and
`client/quiz-feature` appear in both `remoteEntry.json` files and resolve to
one copy at runtime. Native Federation picks them up from the `tsconfig`
path mappings; without that, opening a quiz would download a second country
dataset.

The Angular CLI template budget (500 kB warning) is below the Angular + Ionic
baseline, so the initial budget is **800 kB warning / 1 MB error**. On iOS
the files load from the device, not the network. Pages and translations are
lazy.

## Testing

- Component tests render pages with the real providers
  (`provideShellTesting()`), using in-memory storage, a fixed clock and a chosen language.
- `tools/testing/jsdom-setup.ts` adds the two browser APIs jsdom lacks and
  Ionic uses (`matchMedia`, `Element.scrollTo`); every project that renders
  components loads it.
- Ionic events (`ionChange`) are dispatched as DOM events in tests, which is
  exactly how Angular's Ionic bindings receive them.
- Cypress covers navigation, deep links, system/explicit theme, language
  switching and persistence across reloads, bundled flag assets, and the full
  Capitals quiz journey across the microfrontend boundary.
