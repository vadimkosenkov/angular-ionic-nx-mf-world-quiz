import { InvalidConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('applies development defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      nodeEnv: 'development',
      host: 'localhost',
      port: 3333,
    });
  });

  it('reads and coerces provided values', () => {
    expect(
      loadConfig({ NODE_ENV: 'production', HOST: '0.0.0.0', PORT: '8080' }),
    ).toEqual({
      nodeEnv: 'production',
      host: '0.0.0.0',
      port: 8080,
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
});
