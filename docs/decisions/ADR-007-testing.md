# ADR-007: Testing stack – Vitest, Angular Testing Library, PGlite, Cypress

## Status

Accepted (2026-09-14). Foundation implemented; later levels are added per feature.

## Context

Testing is a primary learning goal. The developer's previous stack was
Karma + Jasmine. Karma is deprecated, and Angular 22 generates new projects
with **Vitest** through `@angular/build:unit-test`.

The project needs five test levels (unit, component, integration, API, E2E)
and must run them locally and in GitHub Actions without special infrastructure.
Cypress is a fixed requirement for E2E; Playwright is explicitly excluded.

Version constraints found in September 2026:

- `@angular/build` 22 and `@nx/vitest` 23 support **Vitest 4** (not 5) → pinned `~4.1`.
- `@nx/cypress` 23 supports **Cypress `>=13 <16`** → pinned Cypress 15.x.
- Docker is not installed on the development machine.

## Decision

| Level                    | Tooling                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit (pure TS)           | **Vitest 4** in Node environment via `@nx/vitest`                                                                                                      |
| Unit/component (Angular) | **Vitest 4** via `@angular/build:unit-test` (jsdom), Angular `TestBed`; **@testing-library/angular** added with the first real components              |
| Integration (client)     | TestBed with real stores/services, `HttpTestingController`, `fake-indexeddb` (added in the offline phase)                                              |
| API                      | **Vitest + supertest** against `createApp()` in-process; **PGlite** (in-process PostgreSQL) for repository tests; real PostgreSQL in CI for migrations |
| E2E                      | **Cypress 15** via `@nx/cypress`, production build served statically                                                                                   |

## Alternatives

| Alternative                  | Why not                                                                                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Karma + Jasmine              | Deprecated; slower; not the Angular default anymore                                                                                                       |
| Jest (`jest-preset-angular`) | Works, but Angular's experimental Jest builder was removed; a second runner alongside Vitest adds config for no gain                                      |
| Vitest browser mode          | Real browser fidelity, but needs a Playwright/WebdriverIO provider; jsdom is sufficient for component logic, and real-browser coverage comes from Cypress |
| Cypress Component Testing    | Attractive for Cypress learning, but Angular 22 + esbuild support is less proven than TestBed + Vitest; can be revisited                                  |
| Testcontainers for API tests | Excellent fidelity but requires Docker locally                                                                                                            |
| Playwright                   | Explicitly excluded by project requirements                                                                                                               |

## Consequences

**Positive**

- One test runner (Vitest) across pure TS, Angular and Node, with a consistent API and fast watch mode.
- API tests run on any machine without Docker.
- E2E runs in CI against a production build, catching build-only problems.

**Negative**

- jsdom is not a real browser; layout, CSS and real input behaviour are only verified by Cypress.
- PGlite is real PostgreSQL compiled to WASM, but extension support and
  concurrency differ from a server. CI therefore also runs migrations against real PostgreSQL.
- Pinned majors (Vitest 4, Cypress 15) lag the newest releases until Nx/Angular catch up.

## Rationale

This follows Angular's and Nx's current defaults wherever they exist, meets the
Cypress requirement, and removes infrastructure prerequisites for everything
except E2E. Details per level: [docs/testing/strategy.md](../testing/strategy.md).
