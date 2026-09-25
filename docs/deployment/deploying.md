# Deploying World Quiz

> Status: ⚙️ Phase 12 — the artefacts and the pipeline exist and run on every
> push; **nothing is hosted yet**. The deploy job stays switched off until an
> environment has its own hosting, so the repository never pretends to have a
> running service. Configuration decisions: [ADR-012](../decisions/ADR-012-environments.md).

## What is deployed

| Part                         | Artefact                                          | Needs                                   |
| ---------------------------- | ------------------------------------------------- | --------------------------------------- |
| `api`                        | Container image `ghcr.io/<owner>/world-quiz-api`  | Node host + PostgreSQL                  |
| `site`                       | Container image `ghcr.io/<owner>/world-quiz-site` | Node host                               |
| `shell`, `capitals`, `flags` | Static bundles (workflow artefact `web-<sha>`)    | Any static hosting, three separate URLs |

Images are built and published by
[`.github/workflows/release.yml`](../../.github/workflows/release.yml) on
every push to `main` (environment **staging**) and on every `v*` tag
(environment **production**, which asks for approval). `ci.yml` also builds
both images on every pull request, without publishing them, so a broken
Dockerfile fails the PR.

## Configuration

**The app is built once and configured at start-up.** The shell reads two
files next to `index.html`, and a deployment replaces them
(`tools/scripts/write-deploy-config.mjs` writes both):

| File                       | Contents                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| `config.json`              | `apiUrl`, `googleClientId` (`apps/shell/src/app/runtime-config.ts`) |
| `federation.manifest.json` | The `remoteEntry.json` URL of each quiz remote                      |

**The site is built per environment.** Its home and legal pages are
prerendered (ADR-003), so the environment's URLs and the operator's contact
are baked into those files at build time; the same values are also passed to
the running container for the pages it renders per request, and travel to the
browser with the page (`TransferState`), so links do not change after
hydration.

**The API is configured entirely from its environment** — one image for every
environment. Variables: `docs/development/environment.md`.

### The variables of an environment

Set these as **variables** of the GitHub Environment (`staging`,
`production`); they are public values:

| Variable                                                                     | Example (staging)                  | Used by                             |
| ---------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------- |
| `API_URL`                                                                    | `https://api.staging.example`      | shell `config.json`, site, checks   |
| `APP_URL`                                                                    | `https://app.staging.example`      | site links, checks                  |
| `SITE_URL`                                                                   | `https://staging.example`          | canonical and `hreflang` links      |
| `CAPITALS_URL`, `FLAGS_URL`                                                  | `https://capitals.staging.example` | federation manifest                 |
| `GOOGLE_CLIENT_ID`                                                           | `…apps.googleusercontent.com`      | Google sign-in in the shell         |
| `SITE_OPERATOR_NAME`, `SITE_OPERATOR_EMAIL`                                  | your name and contact              | legal pages (draft notice if unset) |
| `RENDER_API_SERVICE_ID`, `RENDER_SITE_SERVICE_ID`                            | `srv-…`                            | the deploy job (Render services)    |
| `NETLIFY_SHELL_SITE_ID`, `NETLIFY_CAPITALS_SITE_ID`, `NETLIFY_FLAGS_SITE_ID` | `1a2b…`                            | the deploy job (Netlify sites)      |
| `DEPLOY_ENABLED`                                                             | `true` once the hosting exists     | switches the deploy job on          |

**Secrets** of the environment: `RENDER_API_KEY`, `NETLIFY_AUTH_TOKEN`.
Secrets of the **API service itself** (set in Render, not in GitHub):
`DATABASE_URL`, `AUTH_JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `CORS_ORIGINS`,
`NODE_ENV=production`. The site service needs `NG_ALLOWED_HOSTS` and the
same `API_URL`, `SITE_URL`, `APP_URL` and operator values its image was
built with.

Until an environment has these variables, the `static` job skips writing
them and the artefact keeps the development values it was built with; the
run says so in a notice instead of failing.

**Why Render and Netlify:** both are already familiar, and the two halves fit
what they do — Render runs the two Node services (the API and the site's SSR
server) from the images and offers managed PostgreSQL; Netlify serves the
three static bundles from a CDN. Any equivalent pair works (Fly.io,
Railway, Cloudflare Pages, S3 + CloudFront): only the last two steps of the
deploy job are provider-specific.

## Rules the hosting must satisfy

- **The app and the API must look like one site to the browser.** The
  refresh token is a `SameSite=Strict` cookie, so a browser only sends it
  back when both are the same site. The hosts' own free subdomains are not:
  `*.netlify.app` and `*.onrender.com` are on the
  [Public Suffix List](https://publicsuffix.org/list/), so a browser treats
  them as separate sites, drops the cookie and the player is signed out on
  every reload (ADR-010). Two ways out:
  - **Proxy** (no domain, what this project does): the app is deployed with
    `API_URL=/` and `API_UPSTREAM=https://…`, which publishes a Netlify
    `_redirects` rule proxying `/v1/*` to the API. The browser sees one
    origin, the cookie is first-party, and the API keeps its own address for
    the iPhone app.
  - **A custom domain** with the app and the API as two names under it.
    Costs about 10 USD a year and is the better long-term answer.
- **HTTPS everywhere.** Cookies are `Secure` in production, and Google's
  sign-in only runs on HTTPS origins.
- `CORS_ORIGINS` on the API must list the shell's and the site's origins;
  the site's origin is needed for its client-side board navigation.
- `NG_ALLOWED_HOSTS` on the site container must list the host names it is
  served under, or Angular's SSR server answers `400`.
- The API runs its migrations at start-up, so a deployment is just a new
  image. Run **one instance** while that is true (ADR-005).

## Setting up an environment (once, by hand)

1. Create the hosting: a Render service **from an existing image**
   (`ghcr.io/<owner>/world-quiz-api`; the site gets its own service when it
   is deployed), a PostgreSQL database (Neon's free tier keeps running;
   Render's own free database is deleted after a month), and three Netlify
   sites (shell, capitals, flags). The GHCR packages are public, so Render
   needs no registry credentials.

   The API service's own variables: `NODE_ENV=production`, `HOST=0.0.0.0`,
   `DATABASE_URL`, `AUTH_JWT_SECRET` (`openssl rand -base64 48`),
   `GOOGLE_CLIENT_IDS`, and `CORS_ORIGINS` once the app has an address.
   `PORT` comes from the host. It refuses to start without the first four,
   which is the intended behaviour — a half-configured API is worse than
   none.

2. Point DNS names at them — for example `app`, `api`, `capitals`, `flags`
   and the bare domain for the site — **all under one registrable domain**
   (see the rule above).
3. Set the API service's environment variables and secrets in Render, and
   the site service's variables.
4. In GitHub → Settings → Environments, create `staging` and `production`
   (production: required reviewers), and add the variables and secrets above.
5. Add the deployment's origins to the Google Auth Platform client
   (authorised JavaScript origins), or leave `GOOGLE_CLIENT_ID` empty to run
   without Google sign-in.
6. Set `DEPLOY_ENABLED=true`. The next push to `main` deploys staging; a
   `v1.0.0` tag deploys production after approval.

## Deploying by hand

The artefacts of every commit exist even with deployment switched off:

```bash
# The images (built by CI, public read for the repository's owner)
docker pull ghcr.io/<owner>/world-quiz-api:<sha>
docker run --rm -p 3333:3333 \
  -e DATABASE_URL=postgres://… -e AUTH_JWT_SECRET=… -e NODE_ENV=production \
  ghcr.io/<owner>/world-quiz-api:<sha>

# The static apps: download the workflow artefact `web-<sha>`, then serve
# shell/browser, capitals/browser and flags/browser, each on its own origin.
```

To configure a static bundle for another environment without rebuilding it:

```bash
API_URL=https://api.example GOOGLE_CLIENT_ID=… \
CAPITALS_URL=https://capitals.example FLAGS_URL=https://flags.example \
node tools/scripts/write-deploy-config.mjs dist/apps/shell/browser
```

## Not deployed here

- **iOS** (Phase 13): the remotes are bundled into the app, so there is no
  federation manifest to replace; signing and TestFlight need an Apple
  Developer account.
- **A second API instance**: start-up migrations make that unsafe; a release
  step would have to run them first (ADR-005).
