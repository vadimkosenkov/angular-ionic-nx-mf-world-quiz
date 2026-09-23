import {
  type ApplicationConfig,
  type Provider,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import {
  authInterceptor,
  googleNativeSignIn,
  keychainRefreshTokenStore,
  NATIVE_SIGN_IN,
  provideAuth,
  REFRESH_TOKEN_STORE,
} from '@world-quiz/client/auth';
import { provideFeedback } from '@world-quiz/client/feedback';
import { provideAppI18n } from '@world-quiz/client/i18n';
import { provideProgress } from '@world-quiz/client/progress';
import { provideAppSettings } from '@world-quiz/client/settings';
import { isNativePlatform } from './core/platform';
import { RUNTIME_CONFIG, type RuntimeConfig } from './runtime-config';
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
    { provide: RUNTIME_CONFIG, useValue: runtime },
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
    provideFeedback({ native: isNativePlatform() }),
    provideSignInFlow(),
    ...nativeAuthProviders(runtime),
  ],
});

/**
 * What the iPhone app does differently: it keeps the refresh token in the
 * Keychain (there is no cookie in a web view) and signs in through the
 * system rather than through Google's web page, which Google refuses to
 * show inside an app (ADR-010, docs/deployment/ios.md).
 *
 * On the web this is an empty list, and a build of the app without an iOS
 * Google client keeps the Keychain but has no sign-in to offer — the
 * welcome screen then says so.
 */
function nativeAuthProviders(runtime: RuntimeConfig): Provider[] {
  if (!isNativePlatform()) return [];
  const iosClientId = runtime.googleIosClientId;
  return [
    { provide: REFRESH_TOKEN_STORE, useFactory: keychainRefreshTokenStore },
    ...(iosClientId
      ? [
          {
            provide: NATIVE_SIGN_IN,
            useFactory: () => googleNativeSignIn(iosClientId),
          },
        ]
      : []),
  ];
}
