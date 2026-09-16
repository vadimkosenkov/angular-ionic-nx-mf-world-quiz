# Environment configuration

## Principles

- **Configuration comes from environment variables** (12-factor). No config values are hard-coded per environment.
- **Validated at startup.** The API parses `process.env` with a Zod schema
  ([`apps/api/src/config.ts`](../../apps/api/src/config.ts)) and refuses to
  start if a variable is invalid ("fail fast").
- **Errors name variables, never values**, because later variables are secrets.
- **Secrets are never committed.** `.env` files are git-ignored;
  [`.env.example`](../../.env.example) documents every variable with safe defaults.

## API variables

| Variable   | Default       | Allowed                             | Purpose                                  |
| ---------- | ------------- | ----------------------------------- | ---------------------------------------- |
| `NODE_ENV` | `development` | `development`, `test`, `production` | Runtime mode                             |
| `HOST`     | `localhost`   | non-empty string                    | Bind interface (`0.0.0.0` in containers) |
| `PORT`     | `3333`        | integer 1–65535                     | Listen port                              |

Variables for the database, authentication providers and token signing are
added in their phases, together with this table.

## Frontend configuration

Angular apps have no runtime secrets. Environment-specific values that are
not secret (API base URL, federation manifest) are introduced in later
phases. The Native Federation manifest is deliberately swappable at deploy
time; see [ADR-002](../decisions/ADR-002-microfrontends.md).

## CI

GitHub Actions currently needs no secrets. Deployment and iOS signing
secrets are documented in the CI/CD and iOS phases and are stored as GitHub
encrypted secrets, never in the repository.
