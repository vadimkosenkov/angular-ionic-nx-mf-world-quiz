# Security

> Status: ✅ Phase 14a — review of what the project already did, plus the
> response headers it was missing. This is the summary; the decisions live
> in [ADR-010](../decisions/ADR-010-authentication.md) (sign-in) and
> [ADR-012](../decisions/ADR-012-environments.md) (configuration).

## What protects what

| Risk                                    | What is in place                                                                                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A forged identity                       | The client never says who it is: it sends the **provider's ID token**, and the API verifies signature, issuer, audience and nonce against Google's keys                                   |
| A stolen session                        | Access tokens live 15 minutes and only in memory; refresh tokens **rotate on every use**, and a reused one revokes the whole family (theft detection)                                     |
| Reading the refresh token from the page | Web: httpOnly `SameSite=Strict` cookie, scoped to `/v1/auth`, `Secure` in production. App: the **Keychain**, never `localStorage` or Preferences                                          |
| A cheated leaderboard                   | The server **replays** every session from its own seed and grades it; a challenge's seed comes from the server, is playable once, and its time is checked against the server's own window |
| Credential stuffing                     | `/v1/auth` is rate-limited per client address (`AUTH_RATE_LIMIT`, default 30 per 15 minutes)                                                                                              |
| A hostile page calling the API          | CORS lists exact origins; no wildcard, and credentials only for listed origins. The app's own origin (`capacitor://localhost`) is always allowed                                          |
| Data left behind on a shared device     | The device's data belongs to one account; signing in as someone else deletes it, and sign-out and account deletion wipe it                                                                |
| An oversized or malformed request       | Every body is parsed with a **strict** Zod schema (unknown fields are rejected) and limited to 256 kB                                                                                     |
| Leaking details in errors               | Every error is an RFC 9457 problem document; 500s are logged server-side and say nothing to the client                                                                                    |

## Response headers (added in this phase)

**The API** (`apps/api/src/http/security-headers.ts`) sends, on every
response: `X-Content-Type-Options: nosniff`,
`Content-Security-Policy: frame-ancestors 'none'`,
`Referrer-Policy: no-referrer`, a `Permissions-Policy` that denies camera,
microphone, geolocation and payment, and `Cache-Control: no-store` (routes
that may be cached set their own afterwards).

**The site** (`apps/site/src/server.ts`) sends the same kind of headers plus
a real **Content-Security-Policy** for its pages:

```
default-src 'self'; script-src 'self' 'nonce-…'; style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; connect-src 'self' <API_URL>;
form-action 'none'; frame-ancestors 'none'; base-uri 'self'; upgrade-insecure-requests
```

Angular's hydration inlines two executable scripts into every page, so each
response carries a **fresh nonce** and those tags are given it; an injected
script without the nonce is refused. Styles keep `unsafe-inline`: the build
inlines the critical CSS and Angular adds more at runtime, which a nonce
alone would not cover — a known, smaller risk than allowing inline scripts.

## Deliberately not done

- **No CSP for the app** (`apps/shell`): it is static hosting plus a web
  view, Google's sign-in script comes from Google, and the federated remotes
  are fetched from their own origins — a policy that allowed all of that
  would say very little. The app's pages are also not public documents; the
  API, which holds the data, is the boundary that matters.
- **No secret scanner or dependency bot** in CI: the repository has no
  secrets (`.env` files are ignored, the Google client id is public by
  design), and dependencies are updated by hand in a monorepo where one
  version bump touches every app.
- **`npm audit`**: one low-severity advisory, in `esbuild`'s development
  server on Windows. It is a build-time dependency of Angular's builder,
  it does not ship, and the project does not run that server on Windows.

## Before this goes public

The deployment checklist in [deploying.md](../deployment/deploying.md) is
part of the security posture, not separate from it: HTTPS everywhere, one
registrable domain for the app and the API (or the `SameSite=Strict` cookie
never arrives), `AUTH_JWT_SECRET` set, `AUTH_DEV_LOGIN` off (the config
refuses it in production anyway), and `CORS_ORIGINS` listing only the real
origins.
