# Environment configuration

## Principles

- **Configuration comes from environment variables** (12-factor). No config values are hard-coded per environment.
- **Validated at startup.** The API parses `process.env` with a Zod schema
  ([`apps/api/src/config.ts`](../../apps/api/src/config.ts)) and refuses to
  start if a variable is invalid ("fail fast").
- **Errors name variables, never values**, because later variables are secrets.
- **Secrets are never committed.** `.env` files are git-ignored;
  [`apps/api/.env.example`](../../apps/api/.env.example) documents every
  variable with safe defaults.
- **API variables live next to the API.** Nx loads a `.env` file from the
  workspace root into _every_ task, and the frontend dev servers read `PORT`
  too — a root `.env` with `PORT=3333` made the shell and the remotes try to
  start on the API's port. `apps/api/.env` is loaded only for the API's tasks.

## API variables

| Variable       | Default        | Allowed                             | Purpose                                                                                                                |
| -------------- | -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`     | `development`  | `development`, `test`, `production` | Runtime mode                                                                                                           |
| `HOST`         | `localhost`    | non-empty string                    | Bind interface (`0.0.0.0` in containers)                                                                               |
| `PORT`         | `3333`         | integer 1–65535                     | Listen port                                                                                                            |
| `DATABASE_URL` | unset          | `postgres://…` or `postgresql://…`  | PostgreSQL server. **Required when `NODE_ENV=production`.** Contains credentials: never logged, never echoed in errors |
| `PGLITE_DIR`   | `.data/pglite` | non-empty path                      | Embedded PGlite database used when `DATABASE_URL` is unset (development only; git-ignored)                             |

### Sign-in

| Variable            | Default                                                      | Purpose                                                                           |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `AUTH_JWT_SECRET`   | unset → random key per start (not production)                | HMAC key for access tokens, ≥ 32 characters. **Required in production.** Secret   |
| `GOOGLE_CLIENT_IDS` | empty (Google sign-in disabled)                              | Comma-separated Google OAuth client ids accepted as ID-token audience. Not secret |
| `APPLE_CLIENT_IDS`  | empty (Apple sign-in disabled)                               | Comma-separated Apple client ids (bundle id, Services ID). Not secret             |
| `AUTH_DEV_LOGIN`    | `false`                                                      | `true` enables `POST /v1/auth/dev` (any subject). **Refused in production**       |
| `CORS_ORIGINS`      | `http://localhost:4200` (not production), none in production | Browser origins allowed to call the API with credentials                          |
| `COOKIE_SECURE`     | `true` in production, `false` otherwise                      | `Secure` attribute of the refresh cookie                                          |

The Google client id of the project ("World Quiz Web", Google Auth Platform,
authorized JavaScript origins `http://localhost:4200` and `http://localhost`)
is in `apps/api/.env.example`. Copy it to `apps/api/.env` to run the API with
Google and the dev sign-in enabled:

```bash
cp apps/api/.env.example apps/api/.env
```

Design: [ADR-010](../decisions/ADR-010-authentication.md).

Test-only: `TEST_DATABASE_URL` (a PostgreSQL server where the user may create
databases) runs the API tests against PostgreSQL instead of PGlite; see
[backend.md](../architecture/backend.md#tests-on-pglite-and-on-postgresql).

Why PGlite: [ADR-005](../decisions/ADR-005-database.md).

## Frontend configuration

Angular apps have no runtime secrets. Environment-specific values that are
not secret (API base URL, federation manifest) are introduced in later
phases. The Native Federation manifest is deliberately swappable at deploy
time; see [ADR-002](../decisions/ADR-002-microfrontends.md).

## CI

GitHub Actions currently needs no secrets. Deployment and iOS signing
secrets are documented in the CI/CD and iOS phases and are stored as GitHub
encrypted secrets, never in the repository.
