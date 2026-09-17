# Testing strategy

Tool choices and alternatives: [ADR-007](../decisions/ADR-007-testing.md).

## Goals

1. **Protect behaviour and contracts, not implementation details.** A refactor
   that keeps behaviour should not break tests.
2. **Put each check at the cheapest level that can catch the bug.** Most
   business rules are pure functions, so most tests are fast unit tests.
3. **Deterministic tests.** Time, randomness and I/O are injected (`Clock`, seeded random, fakes). There is no `sleep`.
4. **Runs anywhere.** Everything except E2E runs without a browser, database server or Docker.

## Levels

```
            ▲  fewer, slower, broader
   E2E      │  Cypress: real user journeys on production builds
   API      │  supertest + PGlite: HTTP contract, auth, validation, persistence
   Integr.  │  TestBed + real stores + fake HTTP/IndexedDB
   Component│  TestBed / Testing Library: rendering + interaction
   Unit     │  Vitest: pure domain rules, utilities
            ▼  many, fast, focused
```

| Level                    | Tooling                                                                      | Covers                                                                                                                                                                                                                                                 | Does **not** cover                                                             |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Unit**                 | Vitest (Node env)                                                            | Quiz engine, question/choice generation, answer normalization + fuzzy matching (table-driven, en/ru, aliases, typos, clearly wrong answers), scoring, mastery state machine, achievements, leaderboard eligibility + ranking, sync reducers, utilities | Angular, HTTP, storage                                                         |
| **Component**            | Vitest via `@angular/build:unit-test` (jsdom), TestBed, Testing Library      | What the user sees and does in one component: answer selection, typed input + validation state, timer display, loading/empty/error states, settings controls, leaderboard tabs                                                                         | Real CSS/layout, Ionic internals, animations                                   |
| **Integration (client)** | TestBed with real services/stores, `HttpTestingController`, `fake-indexeddb` | Session completion → outbox → sync; auth token refresh; offline queue and retry                                                                                                                                                                        | Real network, real browser storage quotas                                      |
| **API**                  | Vitest + supertest on `createApp()`; PGlite for repositories                 | Auth (mocked provider keys), authorization, input validation, idempotent result submission, server score recomputation, leaderboard queries, problem-details error format                                                                              | Deployed infrastructure, real OAuth providers                                  |
| **E2E**                  | Cypress 15, production build                                                 | The user journeys listed in the product requirements (sign-in via a test-only provider, each category × difficulty, Timed with `cy.clock`, Endless, Practice Mistakes, achievement unlock, personal record, offline → sync)                            | Exhaustive rule permutations (unit tests own those), real Apple/Google sign-in |

## What we deliberately do not test

- Framework or library behaviour (Angular change detection, Ionic component internals, Express routing itself).
- Trivial getters, generated code, or one-line template bindings without logic.
- Styling details better verified visually.
- The same rule at several levels. For example, answer-matching permutations
  are unit-tested once; E2E only proves the input is wired to the matcher.

## Conventions

- Test files sit next to the code: `*.spec.ts` (unit/component/API), `*.cy.ts` (E2E).
- Name tests by behaviour: `it('rejects negative advances')`, not `it('works')`.
- Prefer `it.each` tables for rule-heavy code (matching, ranking).
- Use `createManualClock()` for anything time-based; never mock `Date` globally.
- E2E selectors use roles/labels or `data-testid`, never CSS structure.

## Current state (after Phase 2)

| Project                      | Tests                                                                                                                                                                                                                                                                                                                                                                      | Level                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `shared-util`                | `Clock`, `Result`, `assertNever`                                                                                                                                                                                                                                                                                                                                           | Unit                                                |
| `quiz-domain`                | Vocabulary; seeded random; dataset validation; answer normalization, edit distance, tolerance, ambiguity guard; question generation (determinism, no repeats, distractor tiers); session engine for every mode (errors, timer, backgrounding, replay); scoring; mastery state machine; progress rebuild and practice list; achievements; challenge eligibility and ranking | Unit (fixture dataset)                              |
| `quiz-countries`             | 195-country scope and region counts; structural validation; unique display labels; no answer shared between countries (all pairs, both categories and languages); real-data Hard-mode cases; SVG flag for every country; full 195-question Hard challenge replayed and ranked                                                                                              | Unit + domain integration (real dataset)            |
| `api`                        | Config validation; `/health` and 404 problem details via supertest                                                                                                                                                                                                                                                                                                         | Unit + API                                          |
| `shell`, `capitals`, `flags` | Root component renders                                                                                                                                                                                                                                                                                                                                                     | Component (placeholder)                             |
| `shell-e2e`                  | Production build is served and renders                                                                                                                                                                                                                                                                                                                                     | E2E smoke (pipeline proof only, not a user journey) |

Domain tests use a small hand-picked fixture with look-alike countries, so a
failure message is easy to read. The real dataset is covered separately
because `quiz-domain` must not depend on `quiz-countries`.

## Running tests

```bash
npm run test                         # all unit/component/API tests
npx nx test quiz-domain              # one project
npx nx affected -t test              # only projects affected by your changes
npm run e2e                          # Cypress against a production build
npx nx open-cypress shell-e2e        # interactive Cypress runner
```
