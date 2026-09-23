import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { authInterceptor, provideAuth } from '@world-quiz/client/auth';
import { provideAppI18n } from '@world-quiz/client/i18n';
import { provideProgress } from '@world-quiz/client/progress';
import { provideAppSettings } from '@world-quiz/client/settings';
import type { RuntimeConfig } from './runtime-config';
import { appRoutes } from './app.routes';
import { provideSignInFlow } from './auth/sign-in.providers';
import { registerIcons } from './icons';

registerIcons();

/**
 * The application's providers. The API URL and the Google client id come
 * from `config.json` (see `runtime-config.ts`), so they are arguments here
 * rather than compiled-in constants.
 */
export const appConfig = (runtime: RuntimeConfig): ApplicationConfig => ({
  providers: [
    provideBrowserGlobalErrorListeners(),
    // iOS look on every platform: the product is an iPhone app first, and one
    // consistent style keeps web and native screenshots identical.
    provideIonicAngular({ mode: 'ios' }),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAppI18n(),
    provideAppSettings(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideAuth({
      apiUrl: runtime.apiUrl,
      googleClientId: runtime.googleClientId,
    }),
    provideProgress(),
    provideSignInFlow(),
  ],
});
