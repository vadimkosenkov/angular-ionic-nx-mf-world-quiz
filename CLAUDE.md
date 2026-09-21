# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Keep this file current.** Every PR that changes commands, projects, boundaries, the shell ↔ remote contract, or a gotcha below updates CLAUDE.md in the same PR.

## What this is

World Quiz — a mobile-first quiz app (country → capital, flag → country, 195 countries, English/Russian) and a **learning/portfolio project**. Nx 23 monorepo with Angular 22 (standalone, zoneless, signals), Ionic 9, Native Federation microfrontends, Capacitor 8, Express 5. Planned: PostgreSQL + Drizzle, Apple/Google sign-in, offline sync, SSR `site`, iOS.

Delivery is in numbered phases, one `feat/<phase>` branch and PR each (table in `docs/architecture/overview.md`). Merged so far: foundation, domain model, shell + design system, Capitals and Flags microfrontends (Phases 4–5). In progress: Phase 6, `feat/backend-database` (API + PostgreSQL). Next: Phase 7, `feat/authentication`.

Project rules that override defaults:

- **Never fake a feature.** Anything not implemented is labelled as such in the UI and in docs (e.g. the leaderboard shows an honest "not available yet" state until sign-in and the API exist). Docs describe what exists; planned items are marked.
- **Workflow:** implement + tests + docs → run the full verification below → show a summary → **stop and ask before commit, push or PR**. The user merges; never merge or force-push.
- Code, comments, docs, commits and PRs are in English. Every change of substance updates the matching doc in `docs/` (and an ADR when a decision changes).

## Commands

Node `^24.15` (`.nvmrc`), npm. Lockfile is committed; use `npm ci`.

```bash
npm run start:quiz        # shell :4200 + capitals :4201 + flags :4202 (needed to play; first start ~1 min)
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
npx nx e2e shell-e2e --configuration=production               # starts shell, capitals and flags static servers
```

`typecheck` runs `ngc --noEmit` for Angular projects, so template errors fail it.

## Architecture

### Projects and enforced boundaries

Tags in each `project.json` + `@nx/enforce-module-boundaries` in the root `eslint.config.mjs` (details: `docs/architecture/nx.md`).

| Project                       | Tags                                         | Role                                                                                                        |
| ----------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/shell`                  | `scope:shell`, `type:app`                    | Ionic host: tabs, Home, quiz setup, Leaderboard, Achievements, Settings; Native Federation **dynamic host** |
| `apps/capitals`, `apps/flags` | `scope:capitals` / `scope:flags`, `type:app` | Federation **remotes** (:4201, :4202); each exposes only `./routes` = `quizRemoteRoutes(category)`          |
| `apps/api`                    | `scope:api`, `type:app`                      | Express 5 + Drizzle: `POST/GET /v1/sessions` (server-graded, idempotent), `/health`                         |
| `apps/shell-e2e`              | `scope:shell`, `type:e2e`                    | Cypress 15                                                                                                  |
| `libs/quiz/domain`            | `scope:shared`, `type:domain`                | Pure TS quiz rules: engine, answer matching, scoring, mastery, progress, achievements, leaderboard          |
| `libs/quiz/countries`         | `scope:shared`, `type:domain`                | The 195-country dataset + flag asset paths                                                                  |
| `libs/shared/contracts`       | `scope:shared`, `type:contracts`             | Zod schemas of the API: requests, responses, problem details                                                |
| `libs/shared/util`            | `scope:shared`, `type:util`                  | `Clock`, `Result`, `assertNever`                                                                            |
| `libs/client/ui`              | `scope:client`, `type:ui`                    | Design system: SCSS tokens/themes/glass + small components                                                  |
| `libs/client/i18n`            | `scope:client`, `type:data-access`           | Transloco with bundled, typed translations                                                                  |
| `libs/client/settings`        | `scope:client`, `type:data-access`           | Theme/language store, storage port, document sync                                                           |
| `libs/client/quiz-ports`      | `scope:client`, `type:ports`                 | The shell ↔ remote contract (+ in-memory ports for standalone remotes)                                      |
| `libs/client/quiz-feature`    | `scope:client`, `type:feature`               | Everything a quiz remote shows: `QuizPage`, play, results, answer feedback, `quizRemoteRoutes()`            |

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
- Not yet: authentication (sessions are anonymous, `user_id` null), rate limiting, client calls (Phase 8).

### Frontend conventions

- Stores are signal-based `@Injectable` classes (`ProgressStore` in the shell, `SettingsStore`, per-page `QuizSessionStore`). Progress is **in memory** until Phase 8.
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

- **Never run a production `build` while `nx serve` is running.** The federation dev server serves shared bundles from `dist/`; a build overwrites them and the app turns blank (404 on `*-dev.js`). Restart the dev server after building.
- **Ionic's global CSS is listed in each app's `styles` array** (`project.json`), not `@import`ed from Sass. The federation dev server leaves package `@import`s unresolved (UI falls back to Times), and `@ionic/angular` only exports exact `css/*.css` paths.
- **Ionic caches pages.** `ion-router-outlet` keeps a stack of page instances and reuses an existing one when the same URL is opened again, so a page may be shown again with its old state. Leave a flow with `NavController.navigateRoot(...)` (the quiz does, for exit and "Back to home"), and reset in `ionViewDidLeave` when a page must start fresh next time (`QuizPage` does; `ionViewWillEnter` would also fire when an iOS swipe-back is cancelled).
- **No solid `ion-button` inside `ion-toolbar`**: Ionic paints its label in the toolbar background colour, which is transparent here.
- **Never write control-character escape sequences in tool input** (a backslash, the letter `u` and four hex digits such as `0000`): they are decoded into raw bytes, and a NUL byte makes git treat the file as binary. `npm run check:control-chars` (also in CI) catches control characters and the U+FFFD replacement character left by such corruption; describe these sequences in words, as here.
- Nx 23 has no Angular Module Federation support; everything federation-related is `@angular-architects/native-federation` 22.x, set up by hand. TypeScript 6 rejects `baseUrl`; only `paths` is used.
- In Ionic's standalone build, `<ion-input>` has no `componentOnReady`; wait for `customElements.whenDefined('ion-input')` before `setFocus()`.

- **A `pg.Pool` must have an `error` listener** (`createPool` in `db/database.ts`): a dropped idle connection otherwise emits an unhandled `error` and kills the API process.
- **Only commit migrations generated by `db-generate`.** Hand-edited SQL drifts from `drizzle/meta` snapshots and the next generation will be wrong. Change `schema.ts`, generate, review the SQL.
- The zod contract for `SubmitSessionRequest` must stay assignable to the domain's `SessionRecord` (a compile-time check in `sessions.spec.ts`); array schemas that mirror domain `readonly` arrays need `.readonly()`.

## Where to read more

`README.md` (overview) · `docs/architecture/` (overview, nx, frontend, backend, microfrontends, design-system, i18n, state-management) · `docs/decisions/` (ADRs) · `docs/domain/` (quiz rules) · `docs/testing/strategy.md` · `docs/development/{setup,troubleshooting}.md` · `docs/deployment/ci-cd.md`.
