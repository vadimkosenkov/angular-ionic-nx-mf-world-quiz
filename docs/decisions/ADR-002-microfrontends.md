# ADR-002: Microfrontends with Native Federation (not classic Module Federation)

## Status

Accepted (2026-09-14). **Implemented for Capitals in Phase 4**
(`feat/capitals-mfe`, 2026-09-17): the shell loads `apps/capitals` over Native
Federation at `/quiz/capitals`, verified end to end in Cypress against two
separately served applications. **Flags followed in Phase 5**
(`feat/flags-mfe`, 2026-09-18) at `/quiz/flags`, with both remotes mounting the
shared `QuizPage`. The iOS manifest swap is planned for Phase 13. What runs today is described in
[microfrontends.md](../architecture/microfrontends.md).

## Context

The product requirement is two independently buildable and deployable frontend
applications, **Capitals** and **Flags**, composed at runtime by a **Shell**.
Runtime composition of independently built Angular apps is an explicit learning goal.

Constraints discovered during Phase 0 (September 2026):

1. **Nx 23 dropped Angular Module Federation.** `@nx/angular:host`, `:remote`,
   `:setup-mf` and the MF dev servers are deprecated (removal in Nx 24). Nx's
   documentation points Angular users to `@angular-architects/native-federation`.
2. **Angular's default build is esbuild** (`@angular/build:application`).
   Classic Module Federation is a webpack/Rspack runtime feature and would
   require leaving Angular's default builder.
3. **iOS distribution.** App Store Review Guideline 2.5.2 prohibits downloading
   executable code that changes app functionality, and the app must work offline.
   Remotes therefore cannot be fetched over the network in the iOS build.
4. **SSR** is being evaluated (ADR-003). The federation approach must not rule it out.

## Decision

Use **Native Federation** (`@angular-architects/native-federation` **22.x**, matching Angular 22):

- `shell` is a **dynamic host**; `capitals` and `flags` are **remotes**.
- Each remote exposes a **routes** entry point; the shell lazy-loads it with
  `loadRemoteModule()` in its router configuration.
- The shell reads a **`federation.manifest.json`** at startup that maps remote
  names to their `remoteEntry.json` URLs. The manifest differs per environment:
  - **Web:** remotes are deployed independently; manifest URLs point to their origins.
  - **iOS (Capacitor):** all three builds are copied into one `www/` bundle and the
    manifest uses relative paths. Nothing is downloaded at runtime.
- Shared dependencies (Angular, Ionic, RxJS, and Nx libraries that hold
  singletons) are configured as **shared singletons** in each `federation.config.js`.
- Shell ↔ remote communication is limited to **routing + query-param contracts +
  injected ports** (`client/quiz-ports`). There is no shared global mutable state.

## Alternatives

| Alternative                                                                                    | Pros                                                                                                                                                                            | Cons                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Native Federation** ✅                                                                       | Uses Angular's esbuild ApplicationBuilder and dev server; built on web standards (ES modules + import maps); SSR/incremental hydration supported; recommended by Nx for Angular | Community-maintained (Angular Architects); no Nx generators, so setup is manual; smaller ecosystem than webpack MF |
| **Classic Module Federation on Rspack** (`@nx/angular-rspack` + `@module-federation/enhanced`) | The original MF runtime; mature for React                                                                                                                                       | Angular MF support deprecated in Nx 23; departs from Angular's default builder; SSR left to the user               |
| **Webpack Module Federation** (`@angular-architects/module-federation`)                        | Most existing tutorials                                                                                                                                                         | Legacy build pipeline for Angular; dead end on both Angular and Nx                                                 |
| **Build-time composition only** (remotes as libraries)                                         | Simplest, one bundle                                                                                                                                                            | Not microfrontends; fails the independent build/deploy requirement                                                 |
| **Web Components / iframes**                                                                   | Framework-agnostic                                                                                                                                                              | Heavy, poor DX for Angular-to-Angular composition, duplicate framework instances                                   |

## How Native Federation works (learning notes)

- **Build time:** for each app, the builder bundles the app with esbuild and
  additionally bundles every _shared_ dependency as a separate ES module. It
  writes `remoteEntry.json` describing exposed modules and shared packages
  with versions.
- **Runtime:** the host loads the manifest, fetches each `remoteEntry.json`,
  negotiates shared package versions, and generates an **import map**. When
  the router calls `loadRemoteModule('capitals', './routes')`, the browser
  resolves the import through that map. Shared singletons (for example
  `@angular/core`) resolve to one instance.
- **Failure modes to handle:** remote unreachable (web), version mismatch of a
  singleton, and a missing exposed module. The shell must render a recoverable
  error route instead of a blank screen. _(Implemented in Phase 4:
  `loadQuizRemoteRoutes` reports the error and mounts a "Quiz unavailable"
  page. Version-mismatch handling is not implemented yet.)_

## Consequences

**Positive**

- Stays on Angular's supported build path. Upgrades follow Angular, not a third-party bundler.
- Works with the offline/iOS requirement by swapping the manifest, not the architecture.
- Keeps the SSR option open.

**Negative**

- More manual wiring and documentation than a generator-based setup.
- Two deployment topologies (web vs iOS) must both be tested.
- Capitals and Flags share most logic through libraries, so each remote is
  thin. The split is intentionally a learning vehicle; this is stated openly
  rather than inflated.

## Rationale

Native Federation is the only option that simultaneously follows Angular's
current build system, is supported by Nx's own guidance, keeps SSR possible,
and fits the iOS/offline bundling constraint.
