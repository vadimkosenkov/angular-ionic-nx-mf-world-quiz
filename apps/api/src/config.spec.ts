import { InvalidConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('applies development defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development',
      host: 'localhost',
      port: 3333,
      database: { kind: 'pglite', dataDir: '.data/pglite' },
      auth: {
        jwtSecret: null,
        googleClientIds: [],
        appleClientIds: [],
        devLogin: false,
        secureCookies: false,
        rateLimit: 30,
      },
      corsOrigins: ['http://localhost:4200', 'http://localhost:4300'],
    });
  });

  it('reads and coerces provided values', () => {
    expect(
      loadConfig({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '8080',
        DATABASE_URL: 'postgres://quiz:secret@db.internal:5432/world_quiz',
        AUTH_JWT_SECRET: 'x'.repeat(32),
        GOOGLE_CLIENT_IDS:
          'web.apps.googleusercontent.com, ios.apps.googleusercontent.com',
        APPLE_CLIENT_IDS: 'dev.worldquiz.app',
        CORS_ORIGINS: 'https://worldquiz.example',
      }),
    ).toEqual({
      nodeEnv: 'production',
      host: '0.0.0.0',
      port: 8080,
      database: {
        kind: 'postgres',
        url: 'postgres://quiz:secret@db.internal:5432/world_quiz',
      },
      auth: {
        jwtSecret: 'x'.repeat(32),
        googleClientIds: [
          'web.apps.googleusercontent.com',
          'ios.apps.googleusercontent.com',
        ],
        appleClientIds: ['dev.worldquiz.app'],
        devLogin: false,
        secureCookies: true,
        rateLimit: 30,
      },
      corsOrigins: ['https://worldquiz.example'],
    });
  });

  it.each(['0', '65536', '80.5', 'abc'])('rejects invalid PORT %s', (port) => {
    expect(() => loadConfig({ PORT: port })).toThrow(InvalidConfigError);
  });

  it('lists every invalid variable without leaking values', () => {
    try {
      loadConfig({ NODE_ENV: 'staging', PORT: 'super-secret-value' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidConfigError);
      const configError = error as InvalidConfigError;
      expect(configError.invalidVariables).toEqual(['NODE_ENV', 'PORT']);
      expect(configError.message).not.toContain('super-secret-value');
      expect(configError.message).not.toContain('staging');
    }
  });

  it('uses PGlite in a custom directory when no DATABASE_URL is set', () => {
    expect(loadConfig({ PGLITE_DIR: '/tmp/quiz' }).database).toEqual({
      kind: 'pglite',
      dataDir: '/tmp/quiz',
    });
  });

  it('requires DATABASE_URL and AUTH_JWT_SECRET in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'Invalid environment configuration: DATABASE_URL, AUTH_JWT_SECRET',
    );
  });

  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://localhost/world_quiz',
    AUTH_JWT_SECRET: 'x'.repeat(32),
  };

  it('never allows the development sign-in in production', () => {
    expect(() => loadConfig({ ...production, AUTH_DEV_LOGIN: 'true' })).toThrow(
      'Invalid environment configuration: AUTH_DEV_LOGIN',
    );
    expect(loadConfig({ AUTH_DEV_LOGIN: 'true' }).auth.devLogin).toBe(true);
  });

  it('rejects a short signing key without echoing it', () => {
    try {
      loadConfig({ AUTH_JWT_SECRET: 'short-secret-value' });
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidConfigError).invalidVariables).toEqual([
        'AUTH_JWT_SECRET',
      ]);
      expect((error as Error).message).not.toContain('short-secret-value');
    }
  });

  it('allows no browser origin in production unless configured', () => {
    expect(loadConfig(production).corsOrigins).toEqual([]);
  });

  it('limits /v1/auth to 30 requests per window unless AUTH_RATE_LIMIT says otherwise', () => {
    expect(loadConfig({}).auth.rateLimit).toBe(30);
    expect(loadConfig({ AUTH_RATE_LIMIT: '1000' }).auth.rateLimit).toBe(1000);
    expect(() => loadConfig({ AUTH_RATE_LIMIT: '0' })).toThrow(
      'AUTH_RATE_LIMIT',
    );
  });

  it('lets COOKIE_SECURE override the default', () => {
    expect(loadConfig({ COOKIE_SECURE: 'true' }).auth.secureCookies).toBe(true);
    expect(
      loadConfig({ ...production, COOKIE_SECURE: 'false' }).auth.secureCookies,
    ).toBe(false);
  });

  it('rejects a DATABASE_URL that is not a PostgreSQL URL, without echoing it', () => {
    try {
      loadConfig({ DATABASE_URL: 'mysql://root:hunter2@localhost/db' });
      expect.unreachable();
    } catch (error) {
      expect((error as InvalidConfigError).invalidVariables).toEqual([
        'DATABASE_URL',
      ]);
      expect((error as Error).message).not.toContain('hunter2');
    }
  });
});
