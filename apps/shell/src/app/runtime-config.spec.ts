import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RUNTIME_CONFIG, loadRuntimeConfig } from './runtime-config';

const respondWith = (body: unknown, ok = true) =>
  vi.fn(async () =>
    Promise.resolve({
      ok,
      status: ok ? 200 : 404,
      json: async () => Promise.resolve(body),
    } as Response),
  );

describe('loadRuntimeConfig', () => {
  it('reads the deployment configuration next to index.html', async () => {
    const fetchJson = respondWith({
      apiUrl: 'https://api.example.test/',
      googleClientId: 'client-id',
    });

    const config = await loadRuntimeConfig(fetchJson);

    expect(fetchJson).toHaveBeenCalledWith('config.json', {
      cache: 'no-cache',
    });
    // A trailing slash would make every request URL contain `//`.
    expect(config).toEqual({
      apiUrl: 'https://api.example.test',
      googleClientId: 'client-id',
      googleIosClientId: null,
      devSignIn: false,
    });
  });

  it('reads the app-only settings when a build provides them', async () => {
    const config = await loadRuntimeConfig(
      respondWith({
        apiUrl: 'https://api.example.test',
        googleClientId: null,
        googleIosClientId: 'ios-client-id',
        devSignIn: true,
      }),
    );

    expect(config.googleIosClientId).toBe('ios-client-id');
    expect(config.devSignIn).toBe(true);
  });

  it('accepts a configuration without a Google client', async () => {
    const config = await loadRuntimeConfig(
      respondWith({ apiUrl: 'https://api.example.test', googleClientId: '' }),
    );

    expect(config.googleClientId).toBeNull();
  });

  it.each([
    ['missing', respondWith({}, false)],
    ['invalid', respondWith({ apiUrl: 42 })],
    [
      'unreachable',
      vi.fn(async () => Promise.reject(new Error('offline'))) as typeof fetch,
    ],
  ])('falls back to the defaults when the file is %s', async (_, fetchJson) => {
    // The fallback reports the reason; the test only needs it silenced.
    const reported = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const config = await loadRuntimeConfig(fetchJson as typeof fetch);

    expect(config).toEqual(DEFAULT_RUNTIME_CONFIG);
    expect(reported).toHaveBeenCalled();
    reported.mockRestore();
  });
});
