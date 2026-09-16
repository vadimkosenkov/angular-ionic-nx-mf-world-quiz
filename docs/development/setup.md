# Local development setup

## Prerequisites

| Tool              | Version                   | Notes                                                                                                                            |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Node.js           | **24.15+** (see `.nvmrc`) | Angular 22 requires `^22.22.3 \|\| ^24.15.0 \|\| >=26`. Older 24.x installs with `EBADENGINE` warnings.                          |
| npm               | 11+                       | Ships with Node 24. The lockfile is committed; use `npm ci` for clean installs.                                                  |
| Git               | any recent                |                                                                                                                                  |
| Xcode + CocoaPods | –                         | Only from the iOS phase onward                                                                                                   |
| PostgreSQL        | –                         | Only from the backend phase onward; the simplest setup is recommended then. Automated API tests use PGlite and need no database. |

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

| What                          | Command                  | URL                          |
| ----------------------------- | ------------------------ | ---------------------------- |
| Shell                         | `npm run start:shell`    | http://localhost:4200        |
| Capitals (standalone for now) | `npm run start:capitals` | http://localhost:4201        |
| Flags (standalone for now)    | `npm run start:flags`    | http://localhost:4202        |
| API                           | `npm run start:api`      | http://localhost:3333/health |

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
