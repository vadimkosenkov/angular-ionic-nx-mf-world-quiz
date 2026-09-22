import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import {
  AUTH_CONFIG,
  authInterceptor,
  GoogleIdentityServices,
} from '@world-quiz/client/auth';
import { provideAppI18n } from '@world-quiz/client/i18n';
import {
  createMemoryLocalStore,
  LOCAL_STORE,
} from '@world-quiz/client/progress';
import {
  createMemoryStorage,
  DEVICE_LANGUAGES,
  KEY_VALUE_STORAGE,
  provideAppSettings,
  SETTINGS_STORAGE_KEY,
  SYSTEM_PREFERS_DARK,
} from '@world-quiz/client/settings';
import type { Locale } from '@world-quiz/quiz/domain';
import { createManualClock } from '@world-quiz/shared/util';
import { signal } from '@angular/core';
import { CLOCK } from '../app/core/tokens';
import { registerIcons } from '../app/icons';

registerIcons();

/** The API origin in shell tests; requests go to `HttpTestingController`. */
export const TEST_API_URL = 'http://api.test';

/** Google's script never loads in jsdom; tests that need it provide a fake. */
const googleNeverLoads: Pick<GoogleIdentityServices, 'load'> = {
  load: () => new Promise(() => undefined),
};

export interface ShellTestingOptions {
  readonly locale?: Locale;
  /** Local wall-clock time used for greetings. */
  readonly now?: Date;
}

/** The shell's real providers, with in-memory storage and a fixed clock. */
export function provideShellTesting(
  options: ShellTestingOptions = {},
): (Provider | EnvironmentProviders)[] {
  const storage = createMemoryStorage({
    [SETTINGS_STORAGE_KEY]: JSON.stringify({
      theme: 'light',
      locale: options.locale ?? 'en',
    }),
  });
  return [
    provideIonicAngular({ mode: 'ios' }),
    provideRouter([]),
    provideAppI18n(),
    provideAppSettings(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideHttpClientTesting(),
    {
      provide: AUTH_CONFIG,
      useValue: { apiUrl: TEST_API_URL, googleClientId: 'test-client-id' },
    },
    { provide: GoogleIdentityServices, useValue: googleNeverLoads },
    { provide: LOCAL_STORE, useValue: createMemoryLocalStore() },
    { provide: KEY_VALUE_STORAGE, useValue: storage },
    { provide: DEVICE_LANGUAGES, useValue: ['en'] },
    { provide: SYSTEM_PREFERS_DARK, useValue: signal(false).asReadonly() },
    {
      provide: CLOCK,
      useValue: createManualClock(
        (options.now ?? new Date(2026, 8, 17, 9, 0)).getTime(),
      ),
    },
  ];
}
