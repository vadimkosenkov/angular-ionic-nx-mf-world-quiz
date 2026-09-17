import {
  computed,
  ErrorHandler,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { detectLocale } from '@world-quiz/client/i18n';
import type { Locale } from '@world-quiz/quiz/domain';
import { DEVICE_LANGUAGES, SYSTEM_PREFERS_DARK } from './environment';
import {
  type AppSettings,
  parseStoredSettings,
  resolveColorScheme,
  SETTINGS_STORAGE_KEY,
  type ThemePreference,
} from './settings';
import { KEY_VALUE_STORAGE } from './storage';

/**
 * Signal-based store for user preferences.
 *
 * - State lives in one private writable signal; components read public
 *   computed signals and change state only through methods.
 * - Changes apply immediately; persistence happens in the background, in
 *   order, so the last change always wins.
 * - Defaults: System theme and the device language.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(KEY_VALUE_STORAGE);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly systemPrefersDark = inject(SYSTEM_PREFERS_DARK);

  private readonly state = signal<AppSettings>({
    theme: 'system',
    locale: detectLocale(inject(DEVICE_LANGUAGES)),
  });
  private pendingWrite: Promise<void> = Promise.resolve();

  readonly theme = computed(() => this.state().theme);
  readonly locale = computed(() => this.state().locale);
  /** What is actually rendered, after resolving `system`. */
  readonly colorScheme = computed(() =>
    resolveColorScheme(this.theme(), this.systemPrefersDark()),
  );

  /**
   * Loads persisted settings. Called once during app initialization.
   * Never throws: if storage cannot be read (plugin failure, blocked
   * storage), the error is reported and the defaults stay in place, so the
   * app still starts.
   */
  async load(): Promise<void> {
    try {
      const raw = await this.storage.get(SETTINGS_STORAGE_KEY);
      this.state.set(parseStoredSettings(raw, this.state()));
    } catch (error: unknown) {
      this.errorHandler.handleError(error);
    }
  }

  setTheme(theme: ThemePreference): void {
    this.update({ theme });
  }

  setLocale(locale: Locale): void {
    this.update({ locale });
  }

  /** Resolves when every change so far has been written (useful in tests). */
  flush(): Promise<void> {
    return this.pendingWrite;
  }

  private update(patch: Partial<AppSettings>): void {
    this.state.update((current) => ({ ...current, ...patch }));
    const snapshot = JSON.stringify(this.state());
    this.pendingWrite = this.pendingWrite
      .then(() => this.storage.set(SETTINGS_STORAGE_KEY, snapshot))
      .catch((error: unknown) => {
        // The setting still applies for this session; report and move on.
        this.errorHandler.handleError(error);
      });
  }
}
