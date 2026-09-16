# ADR-001: Nx monorepo with integrated tsconfig-path libraries

## Status

Accepted (2026-09-14)

## Context

World Quiz consists of several deployable units that share code:

- an Ionic/Angular **shell** (host application),
- two Angular **microfrontends** (Capitals, Flags),
- an **Express API**,
- later a public **SSR site** and an iOS build via Capacitor.

The quiz rules (answer matching, scoring, mastery, leaderboard eligibility) must
be identical on the client, which works offline, and on the server, which
re-validates submitted results. Duplicating them would guarantee drift.

We need a workspace that:

1. shares TypeScript source between browser and Node targets without publishing packages;
2. makes architectural boundaries explicit and machine-checked;
3. keeps CI fast as the number of projects grows;
4. is a technology the developer wants to learn (Nx is an explicit learning goal).

## Decision

Use **Nx 23** as an **integrated monorepo**:

- one root `package.json` (single version policy) managed with **npm**;
- libraries resolved through **`tsconfig.base.json` `paths`** (`@world-quiz/<domain>/<name>`), not npm workspaces;
- every project has `scope:*` and `type:*` tags enforced by `@nx/enforce-module-boundaries`;
- Angular apps use Angular's own esbuild builders (`@angular/build`), the API uses `@nx/esbuild`;
- Nx plugins infer `lint`, `test` and `e2e` targets; `typecheck` is an explicit target per project;
- CI uses `nx affected` and local task caching. Nx Cloud is not used.

## Alternatives

| Alternative                                                      | Why not                                                                                                                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Separate repositories**                                        | Shared domain code would need versioned packages; atomic cross-cutting changes (contract + API + UI) become multi-PR releases.                            |
| **Plain npm/pnpm workspaces + Turborepo**                        | Good task running and caching, but no project graph-based boundary enforcement, no Angular generators, and less relevant to the Angular job market.       |
| **Nx "TS solution" setup (npm workspaces + project references)** | Nx's newer default for TypeScript packages, but Nx does not support it for Angular projects. Mixing two resolution styles in one repo would be confusing. |
| **Angular CLI multi-project workspace**                          | No affected commands, no caching, no boundary rules, no first-class Node/Express projects.                                                                |

## Consequences

**Positive**

- `quiz-domain` is imported by both Angular apps and the API with zero publishing.
- Boundary violations (e.g. domain importing `@angular/core`) fail lint.
- `nx affected` + caching keep CI proportional to the change.
- `nx graph` visualises the architecture for reviewers and interviews.

**Negative**

- Nx is another abstraction over the underlying tools; upgrades should use `nx migrate`.
- Single version policy: every app must move to a new Angular major together.
- Generators occasionally produce defaults that conflict with strict settings
  (see docs/development/troubleshooting.md). Generated code is reviewed, not trusted.
- Nx 23 removed Angular Module Federation support, so federation is not "Nx-native" (see ADR-002).

## Rationale

The project's central architectural claim, "one domain, many runtimes", is
exactly what an integrated monorepo with enforced boundaries makes cheap and
safe. Nx is also the de-facto monorepo tool in the Angular ecosystem, which
fits the portfolio goal.
