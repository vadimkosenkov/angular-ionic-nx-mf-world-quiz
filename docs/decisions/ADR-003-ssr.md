# ADR-003: Server-side rendering in a separate `apps/site`, not in the shell

## Status

Accepted (2026-09-22), Phase 9c (`feat/site-ssr`). The direction was approved
in Phase 0 on the condition of a time-boxed spike of SSR inside the shell;
this ADR records the spike and its result.

## Context

- Some pages must work for search engines, link previews and visitors
  without JavaScript: the Privacy Policy and Terms (required by the App Store
  and by Google's sign-in consent screen) and the public leaderboards.
- The app (`apps/shell` with its Capitals and Flags remotes) is an Ionic,
  offline-first microfrontend host. Everything in it is behind sign-in
  (ADR-011), its data lives in IndexedDB (ADR-006), and the quizzes are
  loaded at runtime over Native Federation (ADR-002).

## The spike: SSR inside the shell

Time-boxed, in a throw-away worktree: `@angular/ssr` and
`@angular/platform-server` added, a `main.server.ts` with
`provideServerRendering`, a `server.ts` with `AngularNodeAppEngine`, and the
shell's `esbuild` target switched to `outputMode: 'server'`. Findings, in the
order the build hit them:

1. **`IndexedDB API missing`** while Angular extracted the routes on the
   server: Dexie opens the database when `ProgressStore` is created
   (`provideProgress()`). Worked around by providing the in-memory
   `LocalStore` on the server.
2. **`window is not defined`**: the web implementation of Capacitor
   Preferences (settings storage) touches `window.localStorage`. Worked around
   with the in-memory settings storage.
3. **Route extraction timed out**: the application never became stable on
   the server — start-up work that waits for the network or the browser
   (restoring the sign-in with the refresh cookie, which the server does not
   have in this request; Google Identity Services; the sync's triggers). Each
   would need a server-specific path.
4. Not reached, but known: Ionic's web components need
   `@ionic/angular-server` to render, and the federated quiz routes would need
   Native Federation on the server (its SSR support is limited).

Even with all of this solved, the result would be poor: the server cannot
see the player's session in a first request, so every route of the app would
render the welcome screen, and the real pages would appear only after the
client signs in — no value for search engines or users, and a large ongoing
cost (every new browser API needs a server fallback).

## Decision

- **`apps/site`** is a separate Angular application with SSR
  (`@angular/ssr`, `outputMode: 'server'`), independent of Ionic and Native
  Federation:
  - home, Privacy Policy and Terms are **prerendered** at build time, in
    English and Russian (`/en/…`, `/ru/…`, `/` redirects by
    `Accept-Language`);
  - the leaderboard (`/:lang/leaderboard/:board`) is **rendered on the server
    for every request** from the public API, cacheable for 30 seconds; the
    API's response travels with the page (HTTP transfer cache), so hydration
    does not fetch it again.
- The site may use only `scope:shared` libraries (contracts, quiz domain,
  design tokens); it shares the app's look through
  `libs/shared/design-tokens`, not through the Ionic design system.
- The shell stays a client-rendered app.

## Alternatives

| Alternative                                  | Why not                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **SSR in the shell** (the spike)             | Blocked by IndexedDB, Capacitor, sign-in and Ionic on the server; renders only the welcome screen for a signed-out request |
| **Static HTML for legal pages** (no Angular) | Simple, but the leaderboard needs live data, and two stacks for one small site is not simpler                              |
| **Prerender the leaderboard** periodically   | Stale between builds; needs a scheduled job                                                                                |
| **Legal pages inside the app**               | Behind sign-in, not crawlable; the App Store and Google need a public URL                                                  |

## Consequences

- A fourth app to build and deploy (Phase 12): a Node server for SSR, with
  `API_URL`, `SITE_URL`, `APP_URL`, `NG_ALLOWED_HOSTS` and the operator's
  contact as environment variables.
- The legal pages show a draft notice until the operator's name and contact
  are configured at deployment; nothing personal is committed.
- The API allows the site's origin in CORS (client-side navigation between
  boards) and serves boards with `public, max-age=0, must-revalidate`, which
  the SSR transfer cache accepts (it refuses `no-cache`).

## Rationale

SSR earns its cost only where content is public and the same for everyone.
That is the legal pages and the leaderboards — a small, separate site — not
the signed-in, offline-first app.
