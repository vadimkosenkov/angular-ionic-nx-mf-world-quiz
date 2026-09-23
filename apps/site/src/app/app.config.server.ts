import { TransferState, inject, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import {
  SITE_CONFIG,
  SITE_CONFIG_STATE,
  siteConfigFromEnvironment,
} from './site-config';

/**
 * On the server the site reads its environment: `API_URL` (the API it
 * renders the leaderboard from), `SITE_URL`, `APP_URL`, and the operator's
 * `SITE_OPERATOR_NAME` / `SITE_OPERATOR_EMAIL` for the legal pages. Unset,
 * the development defaults apply and the legal pages stay drafts.
 *
 * The values travel to the browser with the page, so a link rendered on the
 * server does not change after hydration. Prerendered pages (home, legal)
 * carry the values of the build that rendered them, which is why the site's
 * image is built per environment (docs/deployment/deploying.md).
 */
export const serverConfig = mergeApplicationConfig(appConfig, {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: SITE_CONFIG,
      useFactory: () => {
        const config = siteConfigFromEnvironment(process.env);
        inject(TransferState).set(SITE_CONFIG_STATE, config);
        return config;
      },
    },
  ],
});
