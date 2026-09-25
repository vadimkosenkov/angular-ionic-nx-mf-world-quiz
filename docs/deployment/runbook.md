# Runbook: operating World Quiz

Everything needed to run, change and publish this project, without any
outside help. Commands are run from the repository root.

## Where everything lives

| Part                  | Where                                                               | What it is                                                                   |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| API + database access | Render service, image from GHCR                                     | `https://world-quiz-api-staging.onrender.com`                                |
| Database              | Neon project, free tier                                             | PostgreSQL; the API migrates it at start-up                                  |
| App (shell)           | Netlify site `world-quiz-shell`                                     | `https://world-quiz-shell.netlify.app`                                       |
| Capitals quiz         | Netlify site `world-quiz-capitals`                                  | loaded by the shell at runtime                                               |
| Flags quiz            | Netlify site `world-quiz-flags`                                     | loaded by the shell at runtime                                               |
| Images of API/site    | GitHub Container Registry, built by `.github/workflows/release.yml` | `ghcr.io/vadimkosenkov/world-quiz-api:staging`                               |
| Google sign-in        | Google Cloud Console → Credentials                                  | the web client's _Authorized JavaScript origins_ must list the app's address |

## Day to day

```bash
npm ci                    # after pulling changes that touch package-lock.json
npm run start:quiz        # shell :4200 + capitals :4201 + flags :4202 + api :3333
npm run start:site        # the public SSR site :4300 + api
npm run check             # lint, typecheck, unit tests, builds
npm run e2e               # Cypress against production builds (needs those ports free)
```

If a command complains that a port is in use, something from a previous run
is still alive:

```bash
lsof -iTCP -sTCP:LISTEN -P | grep -E ':(4200|4201|4202|3333|4300) '
kill <pid>
```

## Publishing the web app

**The pipeline builds it.** Every push to `main` builds the API image and
publishes it, and builds the three static bundles as a workflow artefact
(`.github/workflows/release.yml`). Deployment of those bundles runs only
when the GitHub environment has `DEPLOY_ENABLED=true` and the Netlify and
Render credentials.

**One command**, which is how it is published today:

```bash
npm run deploy:web                 # build, configure, publish all three
npm run deploy:web -- --skip-build # when the build is already current
```

It writes the environment's files into the shell's bundle and then runs the
three Netlify deploys with the right `--filter` and site ids
(`tools/scripts/deploy-web.mjs`; every address in it can be overridden from
the environment).

**Step by step**, which is what that script does:

```bash
npx nx run-many -t build -p shell capitals flags --configuration=production

API_URL=/ \
API_UPSTREAM=https://world-quiz-api-staging.onrender.com \
GOOGLE_CLIENT_ID=294520908592-vhhkau8mlstl3s1d105i3efqnopuu0nm.apps.googleusercontent.com \
CAPITALS_URL=https://world-quiz-capitals.netlify.app \
FLAGS_URL=https://world-quiz-flags.netlify.app \
node tools/scripts/write-deploy-config.mjs dist/apps/shell/browser

npx netlify-cli@23 deploy --prod --no-build --filter shell \
  --dir dist/apps/shell/browser --site <shell site id>
npx netlify-cli@23 deploy --prod --no-build --filter capitals \
  --dir dist/apps/capitals/browser --site <capitals site id>
npx netlify-cli@23 deploy --prod --no-build --filter flags \
  --dir dist/apps/flags/browser --site <flags site id>
```

- `--filter <app>` answers Netlify's "which project in this monorepo?"
  question, which otherwise stops the command.
- `API_URL=/` means the app asks its **own** origin, and
  `API_UPSTREAM` is written into `_redirects` as a proxy to the API. That is
  what keeps the sign-in cookie first-party without a custom domain — see
  [deploying.md](deploying.md).
- Site ids: `npx netlify-cli@23 sites:list`.

## Publishing the API

Render runs the image that CI published. A new deployment is a new image:

- **automatically**: push to `main`, wait for the `Release` workflow, then
  press _Manual Deploy → Deploy latest reference_ in Render (or set up the
  deploy job with `RENDER_API_KEY`);
- **by hand**: Render → the service → _Manual Deploy_.

The service's variables live in Render → _Environment_: `NODE_ENV`, `HOST`,
`DATABASE_URL`, `AUTH_JWT_SECRET`, `GOOGLE_CLIENT_IDS`, and `CORS_ORIGINS`
when a browser origin needs to call the API directly. It refuses to start
without a database URL or a signing secret, on purpose.

**Database migrations run at start-up**, so nothing to do by hand. New
migrations are generated from the schema:

```bash
npx nx run api:db-generate     # after editing apps/api/src/db/schema.ts
```

## When something is wrong

| Symptom                                    | Where to look                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| The app says the server cannot be reached  | `curl https://world-quiz-api-staging.onrender.com/health`; on the free tier the first request after 15 minutes idle takes about a minute |
| Signing in does nothing, or fails silently | the app's address must be in the Google client's _Authorized JavaScript origins_                                                         |
| Signed out after every reload              | the sign-in cookie is not first-party: check `_redirects` in the deployed bundle and `API_URL=/`                                         |
| A quiz never loads ("Quiz unavailable")    | open `<remote>/remoteEntry.json` in a browser; check `federation.manifest.json` in the deployed shell                                    |
| A reload of `/home` gives 404              | the `/*  /index.html  200` line in `_redirects`                                                                                          |
| CI fails on `Cypress E2E`                  | the run's log names the spec; `npm run e2e` reproduces it locally                                                                        |

Render's logs: the service → _Logs_. Netlify's: the site → _Deploys_ → a
deploy. Neither keeps secrets in the log; the API never prints its
environment.

## The iPhone app

See [ios.md](ios.md). In short: `npx nx run shell:ios-sync` (with
`API_URL=https://…` for a build that talks to the deployed API), then
`npx nx run shell:ios-open` and Run in Xcode. A free Apple ID signs a build
that lasts seven days.

## Costs, and what would change them

Everything above is free: Render's free service (it sleeps after 15 minutes
of no traffic), Neon's free database, Netlify's free hosting, GitHub
Actions and its registry for a public repository. Paying would buy: a
service that never sleeps (Render, about 7 USD a month), a custom domain
(about 10 USD a year, which also removes the proxy workaround), and the
App Store (Apple Developer Program, 99 USD a year).
