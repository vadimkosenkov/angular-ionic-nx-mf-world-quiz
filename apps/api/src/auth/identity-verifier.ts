import type { IdentityProvider } from '@world-quiz/shared/contracts';
import { err, ok, type Result } from '@world-quiz/shared/util';
import {
  createRemoteJWKSet,
  type JWTPayload,
  jwtVerify,
  type JWTVerifyGetKey,
} from 'jose';
import { createHash } from 'node:crypto';

/** Who the provider says signed in. */
export interface VerifiedIdentity {
  readonly provider: IdentityProvider;
  /** The provider's stable, unique account id (`sub`). */
  readonly subject: string;
  /** Only when the provider vouches for it. */
  readonly email: string | null;
}

export type IdentityError =
  'provider-not-configured' | 'invalid-token' | 'nonce-mismatch';

export interface IdentityVerifier {
  verify(
    provider: IdentityProvider,
    idToken: string,
    nonce: string | undefined,
    now: number,
  ): Promise<Result<VerifiedIdentity, IdentityError>>;
}

/** What is needed to check one provider's tokens. */
export interface ProviderKeys {
  /** Accepted `aud` values: our client ids at that provider. */
  readonly audiences: readonly string[];
  /** The provider's public signing keys (JWKS). */
  readonly keys: JWTVerifyGetKey;
}

const ISSUERS: Readonly<Record<IdentityProvider, readonly string[]>> = {
  google: ['https://accounts.google.com', 'accounts.google.com'],
  apple: ['https://appleid.apple.com'],
};

export const JWKS_URLS: Readonly<Record<IdentityProvider, string>> = {
  google: 'https://www.googleapis.com/oauth2/v3/certs',
  apple: 'https://appleid.apple.com/auth/keys',
};

/** Google's and Apple's published keys, fetched and cached by `jose`. */
export function remoteProviderKeys(
  provider: IdentityProvider,
): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(JWKS_URLS[provider]));
}

const sha256Hex = (value: string) =>
  createHash('sha256').update(value).digest('hex');

/**
 * Verifies provider ID tokens: signature against the provider's published
 * keys, issuer, audience (one of our client ids), expiry and, when the client
 * used one, the nonce.
 *
 * Apple's native flow hands Apple the SHA-256 of the nonce, so the token's
 * `nonce` claim may be the raw value or its hash; both prove the same thing.
 * A provider without configured client ids is disabled.
 */
export function createIdentityVerifier(
  providers: Partial<Readonly<Record<IdentityProvider, ProviderKeys>>>,
): IdentityVerifier {
  return {
    async verify(provider, idToken, nonce, now) {
      const settings = providers[provider];
      if (!settings || settings.audiences.length === 0) {
        return err('provider-not-configured');
      }

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(idToken, settings.keys, {
          algorithms: ['RS256', 'ES256'],
          issuer: [...ISSUERS[provider]],
          audience: [...settings.audiences],
          currentDate: new Date(now),
          requiredClaims: ['sub', 'exp', 'iat'],
        }));
      } catch {
        return err('invalid-token');
      }

      const tokenNonce =
        typeof payload['nonce'] === 'string' ? payload['nonce'] : null;
      if (tokenNonce !== null || nonce !== undefined) {
        const matches =
          nonce !== undefined &&
          tokenNonce !== null &&
          (tokenNonce === nonce || tokenNonce === sha256Hex(nonce));
        if (!matches) return err('nonce-mismatch');
      }

      const verifiedEmail =
        typeof payload['email'] === 'string' &&
        (payload['email_verified'] === true ||
          payload['email_verified'] === 'true')
          ? payload['email']
          : null;

      return ok({
        provider,
        subject: payload.sub as string,
        email: verifiedEmail,
      });
    },
  };
}
