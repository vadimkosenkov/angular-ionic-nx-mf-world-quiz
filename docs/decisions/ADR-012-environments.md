# ADR-012: One build for every environment, configured at start-up

## Status

Accepted (2026-09-22), Phase 12 (`feat/ci-cd`).

## Context

The same commit must be able to run locally, on staging and in production.
Four deployables differ per environment:

- the **shell** needs the API's URL, the Google client id and the URL of each
  quiz remote (`federation.manifest.json`);
- the **quiz remotes** need nothing: they are loaded by the shell;
- the **API** already takes everything from environment variables
  (`config.ts`, validated at start-up);
- the **site** needs the API, app and site URLs and the operator's contact.

Compiling those values into the bundle (Angular's `fileReplacements`) would
mean one build per environment: the artefact tested on staging would not be
the artefact deployed to production, and every environment would pay for a
full build.

## Decision

- **The shell is built once.** It reads `config.json` (API URL, Google client
  id) before `bootstrapApplication`, and the deployment replaces that file
  and `federation.manifest.json`
  (`tools/scripts/write-deploy-config.mjs`). `apps/shell/public/config.json`
  holds the development values, so a plain `nx serve` needs nothing.
  A missing or invalid file is reported in the console and the development
  defaults are used, instead of a blank screen.
- **The API image is environment-independent**: one image, configured by its
  environment variables.
- **The site's image is built per environment.** Its home and legal pages are
  prerendered (ADR-003), so their content — canonical URLs, links to the app,
  the operator's name — is fixed when the build runs. The same values are
  given to the running container for the pages rendered per request, and are
  sent to the browser with the page (`TransferState`), so a link does not
  change after hydration.
- **Environments are GitHub Environments** (`staging` from `main`,
  `production` from a `v*` tag, with approval). Their variables are public
  values; only tokens are secrets.
- **Deployment is off until an environment is configured** (`DEPLOY_ENABLED`),
  while images and static bundles are published for every commit.

## Alternatives

| Alternative                                          | Why not                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Build-time configuration** (`fileReplacements`)    | A different artefact per environment; staging would not test what production runs                             |
| **Values injected into `index.html`** by the host    | Needs a server or an edge function in front of static hosting; `config.json` is a plain file                  |
| **Runtime config for the site too** (no prerender)   | Would drop prerendering, which ADR-003 chose for the legal pages; per-environment images are the smaller cost |
| **Environment variables at build time in the image** | Same as build-time configuration, with a container around it                                                  |

## Consequences

- One more request at start-up (`config.json`, `no-cache`); it is tiny and
  parallel to the federation manifest.
- A wrong `config.json` shows a working app pointing at the wrong API, so the
  deploy job checks `APP_URL/config.json`, `API_URL/health` and `SITE_URL/en`
  after deploying.
- The site's image must be rebuilt when an environment's URLs or operator
  change; the app's bundles need only the two files rewritten.
- Tests inject the configuration directly (`provideShellTesting()`), so they
  never read `config.json`.
