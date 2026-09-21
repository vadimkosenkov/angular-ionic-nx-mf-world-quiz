/** The cookie that carries the refresh token for web clients. */
export const REFRESH_COOKIE = 'wq_refresh';
/** Only the auth endpoints ever receive it. */
export const REFRESH_COOKIE_PATH = '/v1/auth';

/**
 * Attributes of the refresh cookie: not readable from JavaScript, never sent
 * cross-site, only to the auth endpoints, HTTPS-only when `secure`.
 */
export function refreshCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict' as const,
    path: REFRESH_COOKIE_PATH,
  };
}

/** Reads one cookie from a `Cookie` request header. */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
