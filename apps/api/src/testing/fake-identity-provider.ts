import type { IdentityProvider } from '@world-quiz/shared/contracts';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';

export const GOOGLE_CLIENT_ID = 'test-web-client.apps.googleusercontent.com';
export const APPLE_CLIENT_ID = 'dev.worldquiz.test';

const ISSUER: Record<IdentityProvider, string> = {
  google: 'https://accounts.google.com',
  apple: 'https://appleid.apple.com',
};
const AUDIENCE: Record<IdentityProvider, string> = {
  google: GOOGLE_CLIENT_ID,
  apple: APPLE_CLIENT_ID,
};

export interface IdTokenClaims {
  readonly sub?: string;
  readonly iss?: string;
  readonly aud?: string;
  readonly nonce?: string;
  readonly email?: string;
  readonly email_verified?: boolean | string;
  /** Seconds since the epoch. */
  readonly iat?: number;
  readonly exp?: number;
}

export interface FakeIdentityProvider {
  /** Public keys, as `jose` would fetch them from the provider's JWKS URL. */
  readonly keys: JWTVerifyGetKey;
  /** An ID token signed like the real provider's, with overridable claims. */
  issue(
    provider: IdentityProvider,
    claims?: IdTokenClaims,
    options?: { signedByStranger?: boolean },
  ): Promise<string>;
}

/**
 * Stands in for Google and Apple in tests: an RSA key pair whose public half
 * is served as a local JWKS. Tokens are verified by the same code and rules
 * as in production; only where the keys come from differs.
 */
export async function createFakeIdentityProvider(
  now: () => number,
): Promise<FakeIdentityProvider> {
  const provider = await generateKeyPair('RS256');
  const stranger = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(provider.publicKey)),
    kid: 'test-key',
    alg: 'RS256',
  };

  return {
    keys: createLocalJWKSet({ keys: [jwk] }),
    async issue(name, claims = {}, { signedByStranger = false } = {}) {
      const issuedAt = claims.iat ?? Math.floor(now() / 1000);
      const {
        sub = 'provider-user-1',
        iss,
        aud,
        iat: _iat,
        exp,
        ...rest
      } = claims;
      return new SignJWT({ ...rest })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setSubject(sub)
        .setIssuer(iss ?? ISSUER[name])
        .setAudience(aud ?? AUDIENCE[name])
        .setIssuedAt(issuedAt)
        .setExpirationTime(exp ?? issuedAt + 3600)
        .sign(signedByStranger ? stranger.privateKey : provider.privateKey);
    },
  };
}
