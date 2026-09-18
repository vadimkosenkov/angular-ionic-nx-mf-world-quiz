import {
  type EnvironmentProviders,
  type Provider,
  signal,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { provideAppI18n } from '@world-quiz/client/i18n';
import { CLOCK, COUNTRY_DATASET } from '@world-quiz/client/quiz-ports';
import {
  createMemoryStorage,
  DEVICE_LANGUAGES,
  KEY_VALUE_STORAGE,
  provideAppSettings,
  SETTINGS_STORAGE_KEY,
  SYSTEM_PREFERS_DARK,
} from '@world-quiz/client/settings';
import type { Locale } from '@world-quiz/quiz/domain';
import { FIXTURE_DATASET } from '@world-quiz/quiz/domain/testing';
import { createManualClock, type ManualClock } from '@world-quiz/shared/util';
import { registerQuizIcons } from '../lib/quiz-icons';

registerQuizIcons();

/**
 * Providers for the quiz screens in tests: the fixture dataset, a manual
 * clock and in-memory settings. The real applications provide the same
 * tokens with the full dataset and the device's storage.
 */
export function provideQuizTesting(
  options: { readonly locale?: Locale; readonly clock?: ManualClock } = {},
): (Provider | EnvironmentProviders)[] {
  return [
    provideIonicAngular({ mode: 'ios' }),
    provideRouter([]),
    provideAppI18n(),
    provideAppSettings(),
    {
      provide: KEY_VALUE_STORAGE,
      useValue: createMemoryStorage({
        [SETTINGS_STORAGE_KEY]: JSON.stringify({
          theme: 'light',
          locale: options.locale ?? 'en',
        }),
      }),
    },
    { provide: DEVICE_LANGUAGES, useValue: ['en'] },
    { provide: SYSTEM_PREFERS_DARK, useValue: signal(false).asReadonly() },
    { provide: COUNTRY_DATASET, useValue: FIXTURE_DATASET },
    { provide: CLOCK, useValue: options.clock ?? createManualClock(1_000) },
  ];
}
