import {
  type ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppI18n } from '@world-quiz/client/i18n';
import { provideAppSettings } from '@world-quiz/client/settings';
import { appRoutes } from './app.routes';
import { registerIcons } from './icons';

registerIcons();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // iOS look on every platform: the product is an iPhone app first, and one
    // consistent style keeps web and native screenshots identical.
    provideIonicAngular({ mode: 'ios' }),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideAppI18n(),
    provideAppSettings(),
  ],
};
