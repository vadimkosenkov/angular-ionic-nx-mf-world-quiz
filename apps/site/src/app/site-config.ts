import { InjectionToken } from '@angular/core';

/**
 * Where the site points to, and who operates the service.
 *
 * The operator's name and contact address are published on the legal pages.
 * They are deliberately empty in the repository and filled in when the
 * service is deployed (Phase 12); until then the pages say so openly instead
 * of showing an invented contact.
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

export const SITE_CONFIG = new InjectionToken<SiteConfig>('SITE_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_SITE_CONFIG,
});
