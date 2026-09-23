import {
  InjectionToken,
  TransferState,
  inject,
  makeStateKey,
} from '@angular/core';

/**
 * Where the site points to, and who operates the service.
 *
 * The server reads it from its environment and sends it to the browser with
 * the page (`TransferState`), so links keep pointing at the deployed API and
 * app after hydration — the browser bundle knows only the development
 * defaults.
 *
 * The operator's name and contact address are published on the legal pages.
 * They are deliberately empty in the repository and filled in at deployment;
 * until then the pages say so openly instead of showing an invented
 * contact.
 */
export interface SiteConfig {
  /** Public origin of this site, for canonical and `hreflang` links. */
  readonly siteUrl: string;
  /** The web app ("Play"). */
  readonly appUrl: string;
  /** The API, for the public leaderboard. */
  readonly apiUrl: string;
  readonly operator: {
    readonly name: string | null;
    readonly email: string | null;
  };
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  siteUrl: 'http://localhost:4300',
  appUrl: 'http://localhost:4200',
  apiUrl: 'http://localhost:3333',
  operator: { name: null, email: null },
};

/** How the server's configuration reaches the browser. */
export const SITE_CONFIG_STATE = makeStateKey<SiteConfig>('site-config');

export const SITE_CONFIG = new InjectionToken<SiteConfig>('SITE_CONFIG', {
  providedIn: 'root',
  factory: () =>
    inject(TransferState).get(SITE_CONFIG_STATE, DEFAULT_SITE_CONFIG),
});

/** The configuration of a server (or prerender) run, from its environment. */
export function siteConfigFromEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): SiteConfig {
  return {
    siteUrl: env['SITE_URL'] ?? DEFAULT_SITE_CONFIG.siteUrl,
    appUrl: env['APP_URL'] ?? DEFAULT_SITE_CONFIG.appUrl,
    apiUrl: (env['API_URL'] ?? DEFAULT_SITE_CONFIG.apiUrl).replace(/\/$/, ''),
    operator: {
      name: env['SITE_OPERATOR_NAME'] || null,
      email: env['SITE_OPERATOR_EMAIL'] || null,
    },
  };
}
