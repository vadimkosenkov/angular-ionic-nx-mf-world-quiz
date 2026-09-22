# client-auth

Sign-in for the World Quiz app: the signed-in state as signals, the calls to
`/v1/auth` and `/v1/me`, the HTTP interceptor that sends the access token, and
the Google Identity Services button for the web.

Tokens follow [ADR-010](../../../docs/decisions/ADR-010-authentication.md):
the access token lives **only in memory**; on the web the refresh token is an
httpOnly cookie the app never sees. Nothing is written to `localStorage`.
