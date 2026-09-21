import { InvalidConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('applies development defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development',
      host: 'localhost',
      port: 3333,
      database: { kind: 'pglite', dataDir: '.data/pglite' },
    });
  });

  it('reads and coerces provided values', () => {
    expect(
      loadConfig({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: '8080',
        DATABASE_URL: 'postgres://quiz:secret@db.internal:5432/world_quiz',
      }),
    ).toEqual({
      nodeEnv: 'production',
      host: '0.0.0.0',
      port: 8080,
      database: {
        kind: 'postgres',
        url: 'postgres://quiz:secret@db.internal:5432/world_quiz',
      },
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

  it('requires DATABASE_URL in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(
      'Invalid environment configuration: DATABASE_URL',
    );
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
