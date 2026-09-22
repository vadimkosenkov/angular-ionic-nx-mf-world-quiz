import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { DEFAULT_SITE_CONFIG, SITE_CONFIG } from './site-config';

/**
 * On the server the site reads its environment: `API_URL` (the API it
 * renders the leaderboard from), `SITE_URL`, `APP_URL`, and the operator's
 * `SITE_OPERATOR_NAME` / `SITE_OPERATOR_EMAIL` for the legal pages. Unset,
 * the development defaults apply and the legal pages stay drafts.
 */
const env = process.env;

export const serverConfig = mergeApplicationConfig(appConfig, {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: SITE_CONFIG,
      useValue: {
        siteUrl: env['SITE_URL'] ?? DEFAULT_SITE_CONFIG.siteUrl,
        appUrl: env['APP_URL'] ?? DEFAULT_SITE_CONFIG.appUrl,
        apiUrl: env['API_URL'] ?? DEFAULT_SITE_CONFIG.apiUrl,
        operator: {
          name: env['SITE_OPERATOR_NAME'] || null,
          email: env['SITE_OPERATOR_EMAIL'] || null,
        },
      },
    },
  ],
});
