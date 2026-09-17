import {
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  signal,
  type Signal,
} from '@angular/core';

/** The device's preferred languages, most preferred first. */
export const DEVICE_LANGUAGES = new InjectionToken<readonly string[]>(
  'DEVICE_LANGUAGES',
  {
    providedIn: 'root',
    factory: () => inject(DOCUMENT).defaultView?.navigator.languages ?? [],
  },
);

/**
 * Whether the operating system currently prefers a dark appearance.
 * Updates live when the user changes the system setting.
 */
export const SYSTEM_PREFERS_DARK = new InjectionToken<Signal<boolean>>(
  'SYSTEM_PREFERS_DARK',
  {
    providedIn: 'root',
    factory: () => {
      const query = inject(DOCUMENT).defaultView?.matchMedia?.(
        '(prefers-color-scheme: dark)',
      );
      const prefersDark = signal(query?.matches ?? false);
      if (query) {
        const listener = (event: MediaQueryListEvent) =>
          prefersDark.set(event.matches);
        query.addEventListener('change', listener);
        inject(DestroyRef).onDestroy(() =>
          query.removeEventListener('change', listener),
        );
      }
      return prefersDark.asReadonly();
    },
  },
);
