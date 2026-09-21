import { createHash } from 'node:crypto';
import {
  APPLE_CLIENT_ID,
  createFakeIdentityProvider,
  type FakeIdentityProvider,
  GOOGLE_CLIENT_ID,
} from '../testing/fake-identity-provider';
import {
  createIdentityVerifier,
  type IdentityVerifier,
} from './identity-verifier';

const NOW = 1_700_000_000_000;
const NONCE = 'a-random-nonce-of-some-length';

describe('identity verifier', () => {
  let provider: FakeIdentityProvider;
  let verifier: IdentityVerifier;

  beforeAll(async () => {
    provider = await createFakeIdentityProvider(() => NOW);
    verifier = createIdentityVerifier({
      google: { audiences: [GOOGLE_CLIENT_ID], keys: provider.keys },
      apple: { audiences: [APPLE_CLIENT_ID], keys: provider.keys },
    });
  });

  it('accepts a genuine Google token and returns the provider account', async () => {
    const token = await provider.issue('google', {
      sub: 'google-123',
      email: 'ann@example.com',
      email_verified: true,
    });

    expect(await verifier.verify('google', token, undefined, NOW)).toEqual({
      ok: true,
      value: {
        provider: 'google',
        subject: 'google-123',
        email: 'ann@example.com',
      },
    });
  });

  it('ignores an e-mail the provider does not vouch for', async () => {
    const token = await provider.issue('google', {
      email: 'x@example.com',
      email_verified: false,
    });
    const result = await verifier.verify('google', token, undefined, NOW);

    expect(result.ok && result.value.email).toBeNull();
  });

  it.each([
    [
      'signed with a key the provider never published',
      {},
      { signedByStranger: true },
    ],
    [
      'for another app (audience)',
      { aud: 'someone-else.apps.googleusercontent.com' },
      {},
    ],
    ['from another issuer', { iss: 'https://evil.example' }, {}],
    ['expired', { iat: NOW / 1000 - 7200, exp: NOW / 1000 - 3600 }, {}],
  ])('refuses a token %s', async (_name, claims, options) => {
    const token = await provider.issue('google', claims, options);

    expect(await verifier.verify('google', token, undefined, NOW)).toEqual({
      ok: false,
      error: 'invalid-token',
    });
  });

  it('refuses a Google token presented as an Apple one', async () => {
    const token = await provider.issue('google');

    expect(await verifier.verify('apple', token, undefined, NOW)).toEqual({
      ok: false,
      error: 'invalid-token',
    });
  });

  describe('nonce', () => {
    it('accepts the raw nonce (Google) and its SHA-256 (Apple native)', async () => {
      const hashed = createHash('sha256').update(NONCE).digest('hex');
      const google = await provider.issue('google', { nonce: NONCE });
      const apple = await provider.issue('apple', { nonce: hashed });

      expect((await verifier.verify('google', google, NONCE, NOW)).ok).toBe(
        true,
      );
      expect((await verifier.verify('apple', apple, NONCE, NOW)).ok).toBe(true);
    });

    it.each([
      ['a different nonce', { nonce: 'another-nonce-value-1234' }, NONCE],
      ['a token without the nonce the client used', {}, NONCE],
      [
        'a token with a nonce the client did not send',
        { nonce: NONCE },
        undefined,
      ],
    ])('refuses %s', async (_name, claims, nonce) => {
      const token = await provider.issue('google', claims);

      expect(await verifier.verify('google', token, nonce, NOW)).toEqual({
        ok: false,
        error: 'nonce-mismatch',
      });
    });
  });

  it('reports a provider without client ids as not configured', async () => {
    const unconfigured = createIdentityVerifier({
      google: { audiences: [], keys: provider.keys },
    });
    const token = await provider.issue('google');

    expect(await unconfigured.verify('google', token, undefined, NOW)).toEqual({
      ok: false,
      error: 'provider-not-configured',
    });
    expect(await unconfigured.verify('apple', token, undefined, NOW)).toEqual({
      ok: false,
      error: 'provider-not-configured',
    });
  });
});
