# World Quiz

A mobile-first learning app for memorising **world capitals** and **flags**,
built as a full-stack portfolio project on a modern Angular ecosystem: **Nx,
Angular 22 (signals, zoneless), Native Federation microfrontends, Ionic,
Capacitor (iOS), Express 5, PostgreSQL** and a multi-level test strategy.

> **Project status: Phase 7b, sign-in in the app.** The workspace, CI,
> the 195-country dataset, the platform-independent quiz domain and the Ionic
> shell (tabs, Home, Achievements, Leaderboard with an honest "not available
> yet" state, Settings, light/dark design system, English/Russian UI) are in
> place. **Capitals and Flags quizzes are playable**: quiz setup lives in the
> shell, and each quiz is loaded at runtime from its own application over
> Native Federation. Progress, mistakes and achievements update from finished
> sessions, but are kept in memory until the persistence phase. The API signs
> players in with **Google and Apple ID tokens** (short access tokens, rotating
> refresh tokens, account deletion) and records their finished sessions in
> PostgreSQL after **re-grading them on the server**. In the app, players sign
> in with Google (Settings → Account), sign out and delete their account;
> Apple sign-in comes with the iPhone app. Sending results to the account
> (offline sync) and leaderboards come next. This README only describes what
> exists; planned items are marked as such.

## Product in one minute

- **Capitals** (country → capital) and **Flags** (flag → country), for 195 countries.
- **Easy:** choose from four options. **Hard:** type the answer or dictate it with the iOS keyboard. Answers are matched locally, typo-tolerant, in English and Russian.
- **Training modes:** Fixed, Endless, Timed (60 s), Practice Mistakes, by region or worldwide.
- **Mastery and achievements** track real learning progress per region.
- **Global leaderboards** are _perfect-run challenges_: answer all 195 correctly, fastest time wins (4 boards).
- **Offline-first:** play and progress work without a network; results sync later without duplicates.
- **Sign in with Apple / Google**, light/dark themes, Liquid Glass-inspired UI.

Screenshots will be added once both categories are playable. The visual direction
comes from a Figma prototype; its placeholder data is not used.

## Architecture

```mermaid
flowchart LR
  subgraph Client["iOS (Capacitor) / Web"]
    Shell["shell (host)"] -->|Native Federation| Capitals["capitals (remote)"]
    Shell -->|Native Federation| Flags["flags (remote)"]
  end
  Domain["libs/quiz/domain<br/>pure TS rules"]
  Shell & Capitals & Flags -.-> Domain
  API["api (Express)"] -.-> Domain
  Shell -->|REST| API --> DB[(PostgreSQL)]
  Site["site (Angular SSR)"] -->|REST| API
```

The same quiz rules run in the browser (offline play) and on the server
(result validation). More: [architecture overview](docs/architecture/overview.md).

## Technology stack

| Area                     | Choice                                                            | Status                           |
| ------------------------ | ----------------------------------------------------------------- | -------------------------------- |
| Monorepo                 | Nx 23 (integrated, tag-enforced boundaries)                       | ✅                               |
| Frontend                 | Angular 22 (standalone, zoneless, signals), esbuild               | ✅ skeleton                      |
| Microfrontends           | Native Federation 22 (shell host + capitals and flags remotes)    | ✅                               |
| Mobile UI                | Ionic 9 (iOS mode), design tokens, Liquid Glass                   | ✅                               |
| i18n                     | Transloco, English + Russian, `Intl.PluralRules`                  | ✅                               |
| State                    | Angular signal stores (no NgRx)                                   | ✅                               |
| Native (iOS)             | Capacitor 8 (Preferences plugin in use)                           | 📐 Phase 13                      |
| Backend                  | Node 24, Express 5, Zod, esbuild (ESM)                            | ✅ skeleton                      |
| Database                 | PostgreSQL + Drizzle ORM (PGlite for tests and development)       | ✅                               |
| Auth                     | Sign in with Apple, Google; server-verified tokens                | ✅ web: Google · 📐 Apple on iOS |
| Offline                  | IndexedDB (Dexie) + outbox sync                                   | 📐 Phase 8                       |
| SSR                      | Separate Angular SSR `site` app                                   | 📐 Phase 9                       |
| Quiz domain              | Pure TS engine, seeded questions, typo-tolerant matching, mastery | ✅                               |
| Country data             | 195 countries (en/ru), UN M49 regions, `flag-icons` SVGs          | ✅                               |
| Unit/component/API tests | Vitest 4, Angular TestBed, supertest, PGlite                      | ✅ foundation                    |
| E2E                      | Cypress 15                                                        | ✅ smoke test                    |
| CI                       | GitHub Actions + `nx affected`                                    | ✅                               |

✅ implemented · 📐 designed and approved, not implemented yet

## Repository layout

```
apps/
  shell/       Angular host application
  capitals/    Capitals quiz, loaded by the shell as a federated remote
  flags/       Flags quiz, loaded by the shell as a federated remote
  api/         Express API: sessions graded on the server, Drizzle schema + migrations
  shell-e2e/   Cypress tests
libs/
  quiz/domain/    Pure TypeScript quiz rules (no Angular, DOM or Node)
  quiz/countries/ 195-country dataset (English/Russian) and flag paths
  client/ui/       Design system: tokens, themes, glass, UI components
  client/i18n/     Transloco setup and English/Russian translations
  client/settings/ Theme and language settings, storage, document sync
  client/auth/     Sign-in state, API calls, bearer interceptor, Google button
  client/quiz-ports/   Tokens and interfaces shared by the shell and the remotes
  client/quiz-feature/ Quiz play and results screens used by the remotes
  shared/util/ Pure TypeScript helpers
  shared/contracts/ Zod schemas of the API contract (server and client)
docs/          Architecture, decisions (ADRs), domain rules, testing, deployment
```

## Getting started

Requires **Node 24.15+** (`nvm use`).

```bash
npm ci
cp apps/api/.env.example apps/api/.env   # once: Google + dev sign-in for the API
npm run start:quiz     # shell + Capitals + Flags + API: http://localhost:4200
```

| Task                                      | Command          |
| ----------------------------------------- | ---------------- |
| All checks (lint, typecheck, test, build) | `npm run check`  |
| Unit/component/API tests                  | `npm run test`   |
| Cypress E2E                               | `npm run e2e`    |
| Formatting                                | `npm run format` |
| Dependency graph                          | `npm run graph`  |

Details: [setup](docs/development/setup.md) · [environment](docs/development/environment.md) · [troubleshooting](docs/development/troubleshooting.md).

## Documentation

| Topic                            | Document                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Architecture overview and phases | [docs/architecture/overview.md](docs/architecture/overview.md)                 |
| Nx workspace and boundaries      | [docs/architecture/nx.md](docs/architecture/nx.md)                             |
| Decisions (ADRs)                 | [docs/decisions](docs/decisions/README.md)                                     |
| Frontend (shell)                 | [docs/architecture/frontend.md](docs/architecture/frontend.md)                 |
| Backend (API, database)          | [docs/architecture/backend.md](docs/architecture/backend.md)                   |
| Microfrontends (what runs today) | [docs/architecture/microfrontends.md](docs/architecture/microfrontends.md)     |
| Design system and Liquid Glass   | [docs/architecture/design-system.md](docs/architecture/design-system.md)       |
| Internationalization             | [docs/architecture/i18n.md](docs/architecture/i18n.md)                         |
| State management                 | [docs/architecture/state-management.md](docs/architecture/state-management.md) |
| Country dataset                  | [docs/domain/countries.md](docs/domain/countries.md)                           |
| Quiz engine                      | [docs/domain/quiz-engine.md](docs/domain/quiz-engine.md)                       |
| Hard-mode answer matching        | [docs/domain/answer-matching.md](docs/domain/answer-matching.md)               |
| Scoring                          | [docs/domain/scoring.md](docs/domain/scoring.md)                               |
| Achievements                     | [docs/domain/achievements.md](docs/domain/achievements.md)                     |
| Leaderboard rules                | [docs/domain/leaderboard.md](docs/domain/leaderboard.md)                       |
| Mastery rules                    | [docs/domain/mastery.md](docs/domain/mastery.md)                               |
| Testing strategy                 | [docs/testing/strategy.md](docs/testing/strategy.md)                           |
| CI/CD                            | [docs/deployment/ci-cd.md](docs/deployment/ci-cd.md)                           |

## Learning objectives

This project deliberately exercises technologies that are valuable for a
senior Angular engineer, and records _why_ each was chosen, including the
trade-offs, in ADRs:

- Nx monorepo architecture, project graph, affected builds, enforced boundaries
- Angular signals, zoneless change detection, modern control flow and DI
- Runtime microfrontend composition with Native Federation
- Angular SSR and hydration, and when _not_ to use it
- Ionic + Capacitor iOS delivery (signing, TestFlight, App Store)
- Express + PostgreSQL + ORM, API contracts and validation
- OAuth (Apple/Google) with server-side verification and secure token storage
- Offline-first design and idempotent synchronization
- Unit, component, integration, API and Cypress E2E testing
- GitHub Actions CI/CD

## Development workflow

Work happens on feature branches (`feat/*`), one coherent increment per pull
request. Every PR is reviewed and merged manually; `main` stays green.
