# Local development setup

## Prerequisites

| Tool              | Version                   | Notes                                                                                                                                                                                  |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | **24.15+** (see `.nvmrc`) | Angular 22 requires `^22.22.3 \|\| ^24.15.0 \|\| >=26`. Older 24.x installs with `EBADENGINE` warnings.                                                                                |
| npm               | 11+                       | Ships with Node 24. The lockfile is committed; use `npm ci` for clean installs.                                                                                                        |
| Git               | any recent                |                                                                                                                                                                                        |
| Xcode + CocoaPods | –                         | Only from the iOS phase onward                                                                                                                                                         |
| PostgreSQL        | optional                  | Not needed to develop or test: the API falls back to an embedded PGlite database and the tests use PGlite in memory. Install a server only to run against real PostgreSQL (see below). |

With nvm:

```bash
nvm install
nvm use
```

## Install

```bash
npm ci
```

`npm ci` also downloads the Cypress binary into `~/Library/Caches/Cypress`
(macOS). Set `CYPRESS_INSTALL_BINARY=0` if you do not need E2E locally.

## Run

| What                                    | Command                  | URL                          |
| --------------------------------------- | ------------------------ | ---------------------------- |
| **Shell + both remotes + API** (normal) | `npm run start:quiz`     | http://localhost:4200        |
| Shell only                              | `npm run start:shell`    | http://localhost:4200        |
| Capitals standalone (dev ports)         | `npm run start:capitals` | http://localhost:4201        |
| Flags standalone (dev ports)            | `npm run start:flags`    | http://localhost:4202        |
| API                                     | `npm run start:api`      | http://localhost:3333/health |

`start:quiz` streams the four servers' logs with a `shell:` / `capitals:` / `flags:` / `api:` prefix
(`--output-style=stream`); Nx's interactive task view would only show a
spinner for these never-ending tasks. The first start takes up to a minute
while Native Federation bundles the shared packages; wait for the three
`Local: http://localhost:420x/` lines and `[api] listening`. For Google
sign-in and the dev sign-in, create the API's local configuration once:

```bash
cp apps/api/.env.example apps/api/.env
```

The Capitals quiz is a Native Federation remote: with the shell alone,
`/quiz/capitals` shows a "Quiz unavailable" page, because nothing is serving
`http://localhost:4201/remoteEntry.json`. Served on its own, the Capitals app
runs the same quiz against in-memory progress. See
[microfrontends.md](../architecture/microfrontends.md).

### A real PostgreSQL server (optional)

The simplest setup on macOS without Docker is Homebrew:

```bash
brew install postgresql@17
brew services start postgresql@17
createdb world_quiz
DATABASE_URL=postgres://localhost:5432/world_quiz npm run start:api
```

The API applies its migrations on start. The API tests can use the same
server — each test file gets a temporary database:

```bash
TEST_DATABASE_URL=postgres://localhost:5432/world_quiz npx nx test api
```

Details: [backend.md](../architecture/backend.md).

Configuration for the API comes from environment variables; see
[environment.md](environment.md).

## Quality checks

| Check                                    | Command                                        |
| ---------------------------------------- | ---------------------------------------------- |
| Everything CI runs (except format + E2E) | `npm run check`                                |
| Formatting                               | `npm run format:check` / `npm run format`      |
| Lint (incl. module boundaries)           | `npm run lint`                                 |
| Type checking (incl. Angular templates)  | `npm run typecheck`                            |
| Unit/component/API tests                 | `npm run test`                                 |
| Production builds                        | `npm run build`                                |
| Cypress E2E                              | `npm run e2e`                                  |
| Only what your branch changed            | `npx nx affected -t lint typecheck test build` |

Run a single project's target with `npx nx <target> <project>`, e.g.
`npx nx test quiz-domain`.

## Useful Nx commands

```bash
npx nx graph                  # visualise projects and dependencies
npx nx show project shell     # see all targets of a project
npx nx reset                  # clear cache and daemon if Nx behaves oddly
```

If something fails, see [troubleshooting.md](troubleshooting.md).
