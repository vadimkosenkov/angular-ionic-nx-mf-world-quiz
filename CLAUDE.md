# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Keep this file current.** Every PR that changes commands, projects, boundaries, the shell ↔ remote contract, or a gotcha below updates CLAUDE.md in the same PR.

## What this is

World Quiz — a mobile-first quiz app (country → capital, flag → country, 195 countries, English/Russian) and a **learning/portfolio project**. Nx 23 monorepo with Angular 22 (standalone, zoneless, signals), Ionic 9, Native Federation microfrontends, Capacitor 8, Express 5. Planned: PostgreSQL + Drizzle, Apple/Google sign-in, offline sync, SSR `site`, iOS.

Delivery is in numbered phases, one `feat/<phase>` branch and PR each (table in `docs/architecture/overview.md`). Merged so far: foundation, domain model, shell + design system, Capitals and Flags microfrontends (Phases 4–5). Merged: Phase 6 (API + PostgreSQL). Phase 7 is split in two PRs: 7a `feat/auth-server` (sign-in on the API) is merged; in progress 7b `feat/auth-client` (sign-in in the app). Next: Phase 8, `feat/offline-sync`.

Project rules that override defaults:

- **Never fake a feature.** Anything not implemented is labelled as such in the UI and in docs (e.g. the leaderboard shows an honest "not available yet" state until sign-in and the API exist). Docs describe what exists; planned items are marked.
- **Workflow:** implement + tests + docs → run the full verification below → show a summary → **stop and ask before commit, push or PR**. The user merges; never merge or force-push.
- Code, comments, docs, commits and PRs are in English. Every change of substance updates the matching doc in `docs/` (and an ADR when a decision changes).

## Commands

Node `^24.15` (`.nvmrc`), npm. Lockfile is committed; use `npm ci`.

```bash
cp apps/api/.env.example apps/api/.env  # once: API config (Google client id, dev sign-in) — only the API loads it
npm run start:quiz        # shell :4200 + capitals :4201 + flags :4202 + api :3333 (first start ~1 min)
npm run start:shell       # shell only — /quiz/* then shows "Quiz unavailable" (expected)
npm run start:capitals    # a remote standalone (:4201; start:flags → :4202), with in-memory ports
npm run start:api         # http://localhost:3333/health — embedded PGlite in .data/pglite unless DATABASE_URL is set
npx nx run api:db-generate  # after editing apps/api/src/db/schema.ts: writes a SQL migration into apps/api/drizzle/
TEST_DATABASE_URL=postgres://localhost:5432/world_quiz npx nx test api  # API tests on a real PostgreSQL (temporary DB per test file)

npx nx <target> <project>                     # e.g. npx nx test quiz-domain
npx nx affected -t lint typecheck test build  # only what the branch changed
```

Single test file / single test:

- Pure-TS projects (`quiz-domain`, `quiz-countries`, `shared-util`, `api`; plain Vitest): `npx nx test quiz-domain -- src/lib/mastery.spec.ts`, or `-- -t "name"`. Add `--run` in an interactive terminal to avoid watch mode.
- Angular projects (`shell`, `capitals`, `client-*`; `@angular/build:unit-test`): `npx nx test client-ui --include='**/progress-bar.spec.ts'` or `--filter='ProgressBar'`.

Full verification before any commit (this is what CI runs, plus E2E):

```bash
npm run check:control-chars
npx nx format:check                                           # fix with: npx nx format:write
npx nx run-many -t lint typecheck test build --skip-nx-cache
npx nx e2e shell-e2e --configuration=production               # starts shell, capitals, flags (static) and api:serve-e2e (fresh PGlite, dev sign-in)
```

`typecheck` runs `ngc --noEmit` for Angular projects, so template errors fail it.

## Architecture

### Projects and enforced boundaries

Tags in each `project.json` + `@nx/enforce-module-boundaries` in the root `eslint.config.mjs` (details: `docs/architecture/nx.md`).

| Project                       | Tags                                         | Role                                                                                                           |
| ----------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/shell`                  | `scope:shell`, `type:app`                    | Ionic host: tabs, Home, quiz setup, Leaderboard, Achievements, Settings; Native Federation **dynamic host**    |
| `apps/capitals`, `apps/flags` | `scope:capitals` / `scope:flags`, `type:app` | Federation **remotes** (:4201, :4202); each exposes only `./routes` = `quizRemoteRoutes(category)`             |
| `apps/api`                    | `scope:api`, `type:app`                      | Express 5 + Drizzle: `/v1/auth` (Google/Apple ID tokens), `/v1/me`, `/v1/sessions` (per player, server-graded) |
| `apps/shell-e2e`              | `scope:shell`, `type:e2e`                    | Cypress 15                                                                                                     |
| `libs/quiz/domain`            | `scope:shared`, `type:domain`                | Pure TS quiz rules: engine, answer matching, scoring, mastery, progress, achievements, leaderboard             |
| `libs/quiz/countries`         | `scope:shared`, `type:domain`                | The 195-country dataset + flag asset paths                                                                     |
| `libs/shared/contracts`       | `scope:shared`, `type:contracts`             | Zod schemas of the API: sessions, auth, problem details                                                        |
| `libs/shared/util`            | `scope:shared`, `type:util`                  | `Clock`, `Result`, `assertNever`                                                                               |
| `libs/client/ui`              | `scope:client`, `type:ui`                    | Design system: SCSS tokens/themes/glass + small components                                                     |
| `libs/client/auth`            | `scope:client`, `type:data-access`           | `AuthStore`, sign-in API calls, `authInterceptor`, Google (GIS) button                                         |
| `libs/client/i18n`            | `scope:client`, `type:data-access`           | Transloco with bundled, typed translations                                                                     |
| `libs/client/settings`        | `scope:client`, `type:data-access`           | Theme/language store, storage port, document sync                                                              |
| `libs/client/quiz-ports`      | `scope:client`, `type:ports`                 | The shell ↔ remote contract (+ in-memory ports for standalone remotes)                                         |
| `libs/client/quiz-feature`    | `scope:client`, `type:feature`               | Everything a quiz remote shows: `QuizPage`, play, results, answer feedback, `quizRemoteRoutes()`               |

Rules that bite:

- `scope:shared` libraries (`type:domain`/`util`/`contracts`) must stay **platform-free**: ESLint bans Angular, Ionic, Capacitor, RxJS, Express, Dexie, Drizzle and Node built-ins there, and their tsconfig has `lib: ["es2022"]`, `types: []` (no DOM, no Node globals). The same domain code is meant to run on the server to re-grade results.
- Remotes (`scope:capitals`, `scope:flags`) may use `scope:client` and `scope:shared`, never the shell or each other.
- Imports use tsconfig path aliases `@world-quiz/<group>/<lib>` (`tsconfig.base.json`); no npm workspaces. Test-only entry points: `@world-quiz/quiz/domain/testing` (fixture dataset) and `@world-quiz/client/quiz-feature/testing` (`provideQuizTesting()`); never import them from production code.
- `@typescript-eslint/consistent-type-imports` is on: type-only imports use `import type` / `type X`.

### Domain model (`libs/quiz/domain`)

Everything is deterministic and immutable so the server can later **replay** a session to validate it: seeded PRNG (`random.ts`), `createQuizEngine(dataset)` returning new session objects from `start` / `submitAnswer` / `stop` / `expire` / `summarize` / `replay`. Time always comes from an injected `Clock`. Questions are regenerated from `seed` rather than stored. The client never sends score, rank or mastery as facts — only answers. Rules are documented in `docs/domain/*.md`.

### Microfrontends (Native Federation)

Read `docs/architecture/microfrontends.md` before touching federation. Key points:

- `apps/*/src/main.ts` only calls `initFederation(...)`, then imports `bootstrap.ts`. The shell reads `apps/shell/public/federation.manifest.json` (`capitals` → :4201, `flags` → :4202).
- The shell mounts `/quiz/capitals` and `/quiz/flags` via `loadChildren: () => loadQuizRemoteRoutes(name)` (`apps/shell/src/app/quiz/remote-routes.ts`), which falls back to a "Quiz unavailable" page and reports to `ErrorHandler` if loading fails.
- Both remotes expose `quizRemoteRoutes(category)` from `client/quiz-feature`: the shared `QuizPage` with the category in route `data`. A remote contains no screens of its own — its value is its separate build, dev server, `remoteEntry.json` and URL. Adding a quiz type = new app + one-line `remote.routes.ts` + manifest entry + host route + E2E server.
- The contract lives in `libs/client/quiz-ports`: `QUIZ_RESULT_SINK`, `QUIZ_PROGRESS_READER`, `COUNTRY_DATASET`, `CLOCK`, and `QuizRemoteRoutesModule` (the compile-time type of the exposed module). The shell provides implementations **on the route** with `provideQuizPorts()`; the remote never reaches shell stores. Quiz options travel as query params bound with `withComponentInputBinding()`.
- Only **finished** sessions go to the sink (all questions answered, Timed expired, Endless "Finish"). Leaving via the exit button abandons the session and records nothing.
- Workspace libraries are shared through the tsconfig path mappings, so tokens and the dataset exist once at runtime. A library missing from `shared` in `remoteEntry.json` produces duplicate `InjectionToken`s and `NullInjectorError` inside the remote.
- A remote's `app.config.ts` / `app.routes.ts` / `App` exist only for standalone dev, using `provideInMemoryQuizPorts()`.

### Backend (`apps/api`)

Read `docs/architecture/backend.md` and ADR-005 first. Key points:

- Layers: `sessions.routes.ts` (parse with the `shared/contracts` Zod schema, map outcomes to status codes) → `session-service.ts` (plausibility, `engine.replay`, idempotency) → `session-repository.ts` (SQL only) → `db/database.ts`. `createApp()` takes its dependencies; `main.ts` is the only composition root.
- **The server grades.** Requests carry config, seed, timestamps and answers only (strict schema: `score` etc. are rejected). The service replays the session with `quiz-domain` and stores the server's results; a session that cannot be replayed is rejected (422), never corrected.
- Idempotency: client-generated UUID `id` (normalised to lower case by `uuidSchema`) + SHA-256 of the canonical, contract-parsed request (`request-hash.ts`). Never give a new request field a `.default()`: older clients' retries would hash differently and get 409. Same body → 200 with the stored result; different body → 409; races resolved by the primary key + `ON CONFLICT DO NOTHING`.
- Every error is RFC 9457 `application/problem+json` (`http/problem.ts`); 500s are logged, never leak details.
- Two drivers behind one `Database` type: `pg` pool (`DATABASE_URL`) or PGlite (tests: in memory with the real migrations via `createTestDatabase()`; dev: `.data/pglite`). Production requires `DATABASE_URL`. Migrations run at start-up.
- **Auth** (ADR-010, `src/auth/`): the client sends a provider ID token; `identity-verifier.ts` checks it against the provider's JWKS (`jose`), `user-repository.ts` maps `(provider, sub)` to a user. The API issues a 15-min HS256 access token (`Authorization: Bearer`) and an opaque refresh token (SHA-256 stored) that **rotates with reuse detection** (reused → whole family revoked). Refresh token delivery: httpOnly `SameSite=Strict` cookie `wq_refresh` scoped to `/v1/auth` (web) or the response body (native, `refreshTokenIn: 'body'`). `requireAuth` guards `/v1/me` and `/v1/sessions`; `currentUserId(response)` reads the user.
- `POST /v1/auth/dev` exists only with `AUTH_DEV_LOGIN=true` and is refused in production (config). Tests never need real Google/Apple: `testing/fake-identity-provider.ts` signs ID tokens with its own RSA key served as a local JWKS; `testing/test-api.ts` wires the whole app (`signIn()` returns a bearer header).
- Deleting a user cascades to identities, refresh tokens and sessions. A still-valid access token of a deleted user gets 401 where it matters (`owner-missing` on session insert).
- Not yet: client calls to `/v1/sessions` (Phase 8), native Apple sign-in, Keychain storage and Apple token revocation (Phase 13).

### Frontend conventions

- Stores are signal-based `@Injectable` classes (`ProgressStore` in the shell, `SettingsStore`, `AuthStore`, per-page `QuizSessionStore`). Progress is **in memory** until Phase 8.
- Sign-in on the web (`client/auth`, Settings → Account): Google's button via Google Identity Services (not the Capacitor social-login plugin — its web code stores tokens in `localStorage`); the access token only in `AuthStore` memory, the refresh token only in the httpOnly cookie; `provideAuth()` restores at start-up; `authInterceptor` adds `Bearer` to `API_URL` requests only and renews **once, shared** on 401 (parallel refreshes would trip reuse detection). API URL and Google client id: `apps/shell/src/app/api-config.ts`.
- `provideAppSettings()` loads settings and the translation file in an app initializer, so theme and language apply before first render. Dark mode is Ionic's class-based palette (`ion-palette-dark` on `<html>`).
- Translations are TypeScript objects in `libs/client/i18n/src/lib/translations/{en,ru}.ts`; `ru` must match the `TranslationShape` of `en` (compile-time + unit test). Plurals use `wqPlural` (`Intl.PluralRules`). Country names never go into translations — they come from the dataset.
- Ionic runs in `mode: 'ios'` on every platform. Ionic's `ionChange` events are not Angular outputs under strict templates: handlers take `Event`, cast to e.g. `SegmentCustomEvent`, and validate the value with the domain guards (`isDifficulty`, `isQuizScope`, …).
- Design system rules (`docs/architecture/design-system.md`): colours only via `--wq-*` tokens (light + dark defined), one glass material (`glass-chrome`) for the tab bar and headers, a page's next action in the bottom `.wq-action-bar` with `ion-button.wq-glass-button` (solid fill), control text `--wq-font-size-control`, captions `--wq-font-size-caption`. Icons must be registered explicitly (`apps/shell/src/app/icons.ts`, `registerQuizIcons()`).

### Testing

- API tests use supertest against `createApp()` with an in-memory PGlite from `apps/api/src/testing/test-database.ts` (or a temporary PostgreSQL database per file when `TEST_DATABASE_URL` is set — PGlite runs one query at a time, so concurrency is only real on PostgreSQL), and build requests by really playing a session (`testing/play-session.ts`) instead of hand-writing answers.
- Vitest everywhere; Angular projects run through `@angular/build:unit-test` with `buildTarget: shell:esbuild:development` (AnalogJS does not install with Angular 22) and `setupFiles: tools/testing/jsdom-setup.ts` (jsdom lacks `matchMedia` and `scrollTo`).
- Component tests use Testing Library and dispatch Ionic events as DOM events (`ionChange`, `ionInput`); Ionic web components do not upgrade in jsdom, so behaviour that needs them (e.g. input focus) is covered in Cypress.
- Shell pages render with `provideShellTesting()` (in-memory storage, manual clock, chosen locale).
- E2E selectors use `data-testid` or roles.

## Gotchas (each cost real debugging time)

- **Never put `PORT`/`HOST`/`NODE_ENV` in a root `.env`**: Nx loads it into every task, the frontend dev servers read `PORT`, and all of them tried to start on the API's port. API variables live in `apps/api/.env` (loaded only for API tasks).
- **Changing `cypress.config.ts` web-server commands needs `npx nx reset`** (or a daemon restart): the inferred `e2e` target is computed from it and cached in the project graph.
- **Never run a production `build` while `nx serve` is running.** The federation dev server serves shared bundles from `dist/`; a build overwrites them and the app turns blank (404 on `*-dev.js`). Restart the dev server after building.
- **Ionic's global CSS is listed in each app's `styles` array** (`project.json`), not `@import`ed from Sass. The federation dev server leaves package `@import`s unresolved (UI falls back to Times), and `@ionic/angular` only exports exact `css/*.css` paths.
- **Ionic caches pages.** `ion-router-outlet` keeps a stack of page instances and reuses an existing one when the same URL is opened again, so a page may be shown again with its old state. Leave a flow with `NavController.navigateRoot(...)` (the quiz does, for exit and "Back to home"), and reset in `ionViewDidLeave` when a page must start fresh next time (`QuizPage` does; `ionViewWillEnter` would also fire when an iOS swipe-back is cancelled).
- **Third-party iframes on a dark page** (Google's sign-in button) get an opaque white backdrop when their colour scheme differs from the page's; give the iframe's container `color-scheme: light` (see `google-sign-in-button.ts`). GIS also cannot change a rendered button: redraw it when the language changes. Google may ignore its `locale` for browsers signed in to Google, and answers 403 to `gsi/client` for some Google sessions (incognito works): not our bug.
- **No solid `ion-button` inside `ion-toolbar`**: Ionic paints its label in the toolbar background colour, which is transparent here.
- **Never write control-character escape sequences in tool input** (a backslash, the letter `u` and four hex digits such as `0000`): they are decoded into raw bytes, and a NUL byte makes git treat the file as binary. `npm run check:control-chars` (also in CI) catches control characters and the U+FFFD replacement character left by such corruption; describe these sequences in words, as here.
- Nx 23 has no Angular Module Federation support; everything federation-related is `@angular-architects/native-federation` 22.x, set up by hand. TypeScript 6 rejects `baseUrl`; only `paths` is used.
- In Ionic's standalone build, `<ion-input>` has no `componentOnReady`; wait for `customElements.whenDefined('ion-input')` before `setFocus()`.

- **Adding a NOT NULL column or FK to a table with data needs a data migration first**: `npx drizzle-kit generate --config apps/api/drizzle.config.ts --custom --name <name>` creates an empty, tracked SQL file (write the `UPDATE`/`DELETE` there), then run `db-generate` for the schema change — see `0001_drop_anonymous_sessions.sql`.
- **A `pg.Pool` must have an `error` listener** (`createPool` in `db/database.ts`): a dropped idle connection otherwise emits an unhandled `error` and kills the API process.
- **Only commit migrations generated by `db-generate`.** Hand-edited SQL drifts from `drizzle/meta` snapshots and the next generation will be wrong. Change `schema.ts`, generate, review the SQL.
- The zod contract for `SubmitSessionRequest` must stay assignable to the domain's `SessionRecord` (a compile-time check in `sessions.spec.ts`); array schemas that mirror domain `readonly` arrays need `.readonly()`.

## Where to read more

`README.md` (overview) · `docs/architecture/` (overview, nx, frontend, backend, microfrontends, design-system, i18n, state-management) · `docs/decisions/` (ADRs) · `docs/domain/` (quiz rules) · `docs/testing/strategy.md` · `docs/development/{setup,troubleshooting}.md` · `docs/deployment/ci-cd.md`.
