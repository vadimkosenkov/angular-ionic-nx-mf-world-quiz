# Public site (`apps/site`)

> Status: ✅ Phase 9c — Angular SSR site: home, Privacy Policy and Terms
> (prerendered), public leaderboards (server-rendered), English and Russian.
> Why a separate app: [ADR-003](../decisions/ADR-003-ssr.md).

## What it is for

Pages that must be public, crawlable and readable without JavaScript:

| URL                         | Render mode                     | Content                                         |
| --------------------------- | ------------------------------- | ----------------------------------------------- |
| `/`                         | server redirect                 | `302` to `/en` or `/ru` by `Accept-Language`    |
| `/:lang`                    | **prerendered** (build time)    | what World Quiz is, links to the app and boards |
| `/:lang/privacy`, `/terms`  | **prerendered**                 | Privacy Policy, Terms of Use                    |
| `/:lang/leaderboard`        | redirect                        | → `/:lang/leaderboard/capitals-easy`            |
| `/:lang/leaderboard/:board` | **server-rendered** per request | the board's ranking from the API                |
| anything else               | server-rendered                 | `404` page                                      |

`:lang` is `en` or `ru` (`canMatch`), `:board` one of the four boards.

## Structure

```
apps/site/src/
  main.ts / main.server.ts   browser and server bootstraps
  server.ts                  Express: `/` redirect, static files, Angular SSR
  app/
    app.routes.ts            /:lang/… with canMatch guards
    app.routes.server.ts     RenderMode per route (Prerender / Server)
    app.config(.server).ts   hydration, HttpClient; server reads the environment
    site-config.ts           SITE_CONFIG: site, app and API URLs, operator
    i18n/                    en.ts, ru.ts (typed, same shape), SiteI18n, language
    layout/site-layout.*     header, nav, language switch, footer; lang, canonical, hreflang
    pages/                   home, legal (privacy|terms), leaderboard, not found
```

Boundaries: `scope:site` may use only `scope:shared` — the API contracts
(`leaderboardSchema`), the quiz domain (`LEADERBOARD_BOARDS`,
`formatRunTime`) and the design tokens. Not Ionic, not `client/*`.

## Languages

Texts are TypeScript objects (`i18n/en.ts`, `i18n/ru.ts`); `ru` is typed as
`SiteText`, so a missing text is a compile error, and a test compares their
shapes. The language comes from the URL (`SiteLayout` sets `SiteI18n`,
`<html lang>`, a canonical link and `hreflang` alternates for both
languages). The language switch links to the same page in the other language.

## Data and caching

- The leaderboard page uses `httpResource` on `GET /v1/leaderboards/:board`,
  parsed with the shared contract. On the server the API is reached at
  `API_URL`.
- **Transfer cache**: the response made while rendering is embedded in the
  HTML, and hydration reuses it — the browser does not call the API for the
  first page. (Angular refuses to carry responses marked `no-store`,
  `private` or `no-cache`; the API therefore sends boards as
  `public, max-age=0, must-revalidate`.)
- Navigating to another board in the browser calls the API directly: the
  site's origin is in the API's CORS list (`http://localhost:4300` by default
  in development).
- The rendered page is `Cache-Control: public, max-age=30`; if the API cannot
  be reached, the page says so with `503` and `no-store`.

## Legal pages and the operator

The texts describe what the service does as built (stored data, device
storage, the one sign-in cookie, deletion); change them with the code. The
operator's name and contact come from `SITE_OPERATOR_NAME` /
`SITE_OPERATOR_EMAIL` at deployment. Unset — as in the repository — the
pages carry a visible **draft** notice instead of an invented contact.

## Configuration (server environment)

| Variable                                    | Default                 | Purpose                                                                              |
| ------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `PORT`                                      | `4300`                  | Port of the Node server                                                              |
| `API_URL`                                   | `http://localhost:3333` | API the leaderboard is rendered from                                                 |
| `SITE_URL`                                  | `http://localhost:4300` | Public origin, for canonical and `hreflang` links                                    |
| `APP_URL`                                   | `http://localhost:4200` | "Play" links                                                                         |
| `SITE_OPERATOR_NAME`, `SITE_OPERATOR_EMAIL` | unset (draft notice)    | Operator and contact on the legal pages                                              |
| `NG_ALLOWED_HOSTS`                          | none                    | Host names the server answers (Angular SSR's host check); `localhost` in `serve-ssr` |

The browser build uses the development defaults of `SITE_CONFIG`; only the
leaderboard's client-side navigation needs the API URL there, which Phase 12
makes per-environment.

## Running

```bash
npm run start:site             # site dev server with SSR on :4300 + the API
npx nx run site:serve-ssr      # production build served by its Node server
```

## Tests

- Unit (Vitest): language negotiation; `en`/`ru` shapes and plurals;
  leaderboard table, empty and unavailable states, response status and
  cache headers; legal pages as draft and with an operator; the layout's
  language, canonical and `hreflang` links.
- E2E (`apps/shell-e2e/src/e2e/site.cy.ts`, against the production server):
  the `/` redirect by language, prerendered legal pages, a server-rendered
  board with its cache header, `404` for an unknown board — and in
  `leaderboard.cy.ts`, a run played in the app appearing in the site's
  server-rendered HTML.
