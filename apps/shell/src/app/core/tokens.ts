import { InjectionToken } from '@angular/core';
import { COUNTRIES } from '@world-quiz/quiz/countries';
import type { CountryDataset } from '@world-quiz/quiz/domain';
import { type Clock, systemClock } from '@world-quiz/shared/util';

/** The country dataset. Injected so tests can use a smaller one. */
export const COUNTRY_DATASET = new InjectionToken<CountryDataset>(
  'COUNTRY_DATASET',
  { providedIn: 'root', factory: () => COUNTRIES },
);

/** Wall clock, injectable for deterministic tests. */
export const CLOCK = new InjectionToken<Clock>('CLOCK', {
  providedIn: 'root',
  factory: () => systemClock,
});
