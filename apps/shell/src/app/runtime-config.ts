/**
 * Where the app finds the API and which Google client it signs in with.
 *
 * Both are public values (the browser sees them anyway), but they differ per
 * environment, so they are **not** compiled into the bundle: the app reads
 * `config.json` next to `index.html` before it starts, and a deployment
 * replaces that one file. The same build therefore runs on every environment
 * ("build once, deploy anywhere"); the remotes' URLs travel the same way, in
 * `federation.manifest.json`.
 *
 * `apps/shell/public/config.json` holds the development values.
 */
export interface RuntimeConfig {
  /** Origin of the API, without a trailing slash. */
  readonly apiUrl: string;
  /** Google Identity Services client id; `null` disables Google sign-in. */
  readonly googleClientId: string | null;
}

/** Used when `config.json` cannot be read: local development values. */
export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  apiUrl: 'http://localhost:3333',
  googleClientId:
    // "World Quiz Web" in Google Auth Platform (origins: localhost:4200).
    '294520908592-vhhkau8mlstl3s1d105i3efqnopuu0nm.apps.googleusercontent.com',
};

const isRuntimeConfig = (value: unknown): value is RuntimeConfig => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['apiUrl'] === 'string' &&
    candidate['apiUrl'].length > 0 &&
    (candidate['googleClientId'] === null ||
      typeof candidate['googleClientId'] === 'string')
  );
};

/**
 * Reads `config.json`. A missing or invalid file is reported and the
 * development defaults are used, so a misconfigured deployment shows the
 * reason in the console instead of a blank screen.
 */
export async function loadRuntimeConfig(
  fetchJson: typeof fetch = fetch,
): Promise<RuntimeConfig> {
  try {
    const response = await fetchJson('config.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`config.json: ${response.status}`);
    const value: unknown = await response.json();
    if (!isRuntimeConfig(value)) throw new Error('config.json is not valid');
    return {
      apiUrl: value.apiUrl.replace(/\/$/, ''),
      googleClientId: value.googleClientId || null,
    };
  } catch (error) {
    console.error('[shell] falling back to the default configuration', error);
    return DEFAULT_RUNTIME_CONFIG;
  }
}
