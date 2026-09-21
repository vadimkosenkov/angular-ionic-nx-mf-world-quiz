# ADR-010: Sign-in with provider ID tokens, short JWT access tokens, rotating refresh tokens

## Status

Accepted (2026-09-21). Server side implemented in Phase 7a (`feat/auth-server`);
the client follows in Phase 7b (`feat/auth-client`), native iOS storage in Phase 13.

## Context

- Players sign in with **Apple** and **Google** only (product requirement; the
  App Store requires Sign in with Apple when other social logins are offered).
- Clients: the web app (the shell in a browser) and the iOS app (Capacitor).
- The API must never trust a client-provided user id, score or rank, and must
  let a user delete their account from inside the app (App Store Review
  Guideline 5.1.1(v)).
- Tokens must not live in `localStorage` (readable by any script on the page).
- Tests and local development must work without real Apple/Google credentials.

## Decision

1. **The client signs in with the provider; the server verifies.** The client
   obtains an OpenID Connect **ID token** from Apple or Google and sends it to
   `POST /v1/auth/{apple,google}`. The server checks it with `jose` against the
   provider's published keys (JWKS): signature, issuer, audience (our client
   ids, from configuration), expiry, and the nonce when one was used. The
   provider's stable `sub` identifies the account; e-mail is informational and
   never used to link accounts.
2. **Our own session:** a **15-minute JWT access token** (HS256, server key
   `AUTH_JWT_SECRET`, only the user id inside) sent as `Authorization: Bearer`,
   and an **opaque 256-bit refresh token** valid for 30 days, stored only as a
   SHA-256 hash.
3. **Refresh tokens rotate with reuse detection.** Every refresh retires the
   presented token and issues its successor in the same _family_. A retired
   token presented again means a copy exists, so the whole family is revoked.
4. **Where the refresh token lives**, chosen by the client per request:
   - web: an `httpOnly`, `SameSite=Strict`, `Secure` (in production) cookie
     scoped to `Path=/v1/auth` — scripts cannot read it and other sites cannot
     send it; the access token stays in memory;
   - native: in the response body, for the iOS Keychain.
5. **Account deletion** (`DELETE /v1/me`) deletes the user; identities, refresh
   tokens and sessions go with it by foreign-key cascade.
6. **Development sign-in** (`POST /v1/auth/dev`, any subject) exists only when
   `AUTH_DEV_LOGIN=true`, and the server refuses to start with it in
   production. Tests use a fake identity provider: an RSA key pair served as a
   local JWKS, verified by the same code as the real providers.
7. Sign-in endpoints are **rate-limited** per client address.

## Alternatives

| Alternative                                              | Why not                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Server-side sessions only** (opaque session id cookie) | Simple and revocable, but the native app would need cookie handling in a WebView and every API call a database lookup; the refresh-token pair gives both clients one model |
| **Long-lived JWT, no refresh**                           | Cannot be revoked; a stolen token works until it expires                                                                                                                   |
| **Refresh token in `localStorage`**                      | Readable by any injected script (XSS)                                                                                                                                      |
| **Auth provider service** (Firebase Auth, Auth0, Clerk)  | Less to build, but hides exactly what this project is meant to teach, adds an external dependency and account                                                              |
| **Passport.js** strategies                               | Built around redirect flows and sessions; verifying an ID token with `jose` is a few lines and fully visible                                                               |
| **Asymmetric access tokens** (RS256/EdDSA)               | Needed when other services verify our tokens; one API verifies its own tokens, so HMAC is simpler. Revisit if the SSR site must verify tokens itself                       |

## Consequences

**Positive**

- No passwords, no e-mail verification, no password reset: providers do that.
- A stolen refresh token is useful only until the real client refreshes; the
  next use by either side revokes the family.
- The whole flow is tested without network access or real credentials.

**Negative**

- Access tokens cannot be revoked before they expire (up to 15 minutes). A
  deleted account's token is refused where it matters: `/v1/me` and session
  recording check that the user still exists.
- Two refreshes racing with the same token look like reuse and sign the client
  out; clients must serialise refreshes (Phase 7b).
- The nonce is generated by the client, not issued by the server, so it binds
  the ID token to the client's request but is not a server-side replay check.
  ID tokens are short-lived and audience-bound, which limits the gap.
- **Sign in with Apple on the web** needs a registered HTTPS domain and a
  Services ID, so it is not available on `localhost`; Apple is verified in
  tests and lands on devices with the iOS app (Phase 13).
- Revoking Apple's tokens on account deletion (Apple's REST API with a signed
  client secret) needs the Apple developer key; it is added with the iOS phase.

## Rationale

Verifying provider ID tokens ourselves and issuing a short access token plus a
rotating refresh token is the smallest design that satisfies both clients,
keeps tokens out of script-readable storage, makes theft detectable, and stays
fully testable — while every step remains visible code rather than a hosted
service's black box.
