import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppI18n } from '@world-quiz/client/i18n';
import { registerQuizIcons } from '@world-quiz/client/quiz-feature';
import { provideAppSettings } from '@world-quiz/client/settings';
import { appRoutes } from './app.routes';

registerQuizIcons();

/**
 * Configuration of the *standalone* Flags app. Under Native Federation the
 * shell bootstraps the application and provides Ionic, i18n and settings;
 * this config only exists so the remote can be served and tested on its own.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideIonicAngular({ mode: 'ios' }),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAppI18n(),
    provideAppSettings(),
  ],
};
