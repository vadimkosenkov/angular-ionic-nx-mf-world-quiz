import { ACCESS_TOKEN_TTL_MS, createAccessTokens } from './access-tokens';

const NOW = 1_700_000_000_000;
const USER = '1f0e6b8f-0000-4000-8000-000000000001';
const tokens = createAccessTokens('a-secret-that-is-at-least-32-characters');

describe('access tokens', () => {
  it('carry the user id until they expire', async () => {
    const { token, expiresAt } = await tokens.issue(USER, NOW);

    expect(expiresAt).toBe(NOW + ACCESS_TOKEN_TTL_MS);
    expect(await tokens.verify(token, NOW + ACCESS_TOKEN_TTL_MS - 1_000)).toBe(
      USER,
    );
    expect(
      await tokens.verify(token, NOW + ACCESS_TOKEN_TTL_MS + 1_000),
    ).toBeNull();
  });

  it('are refused when signed with another key or tampered with', async () => {
    const other = createAccessTokens('another-secret-that-is-32-characters!');
    const { token } = await other.issue(USER, NOW);
    expect(await tokens.verify(token, NOW)).toBeNull();

    const genuine = (await tokens.issue(USER, NOW)).token;
    const [header, , signature] = genuine.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', exp: NOW / 1000 + 900 }),
    ).toString('base64url');
    expect(
      await tokens.verify(`${header}.${forgedPayload}.${signature}`, NOW),
    ).toBeNull();
  });

  it('refuse an unsigned token (alg "none")', async () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: USER,
        iss: 'world-quiz-api',
        aud: 'world-quiz',
        exp: NOW / 1000 + 900,
      }),
    ).toString('base64url');

    expect(await tokens.verify(`${header}.${payload}.`, NOW)).toBeNull();
  });
});
