import { jwtVerify, SignJWT } from 'jose';

/** Access tokens are short-lived; the refresh token renews them. */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

const ISSUER = 'world-quiz-api';
const AUDIENCE = 'world-quiz';

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: number;
}

/**
 * Stateless bearer tokens: a JWT signed with the server's HMAC key, carrying
 * only the user id. Verifying one needs no database; revocation happens by
 * letting it expire and refusing to refresh.
 */
export interface AccessTokens {
  issue(userId: string, now: number): Promise<IssuedAccessToken>;
  /** The user id, or `null` for anything invalid or expired. */
  verify(token: string, now: number): Promise<string | null>;
}

export function createAccessTokens(secret: string): AccessTokens {
  const key = new TextEncoder().encode(secret);
  const seconds = (ms: number) => Math.floor(ms / 1000);

  return {
    async issue(userId, now) {
      const expiresAt = now + ACCESS_TOKEN_TTL_MS;
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setSubject(userId)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setIssuedAt(seconds(now))
        .setExpirationTime(seconds(expiresAt))
        .sign(key);
      return { token, expiresAt };
    },

    async verify(token, now) {
      try {
        const { payload } = await jwtVerify(token, key, {
          algorithms: ['HS256'],
          issuer: ISSUER,
          audience: AUDIENCE,
          currentDate: new Date(now),
        });
        return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
        return null;
      }
    },
  };
}
