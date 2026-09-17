import {
  ApplicationInitStatus,
  ApplicationRef,
  DOCUMENT,
  ErrorHandler,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideAppI18n } from '@world-quiz/client/i18n';
import { DEVICE_LANGUAGES, SYSTEM_PREFERS_DARK } from './environment';
import { SETTINGS_STORAGE_KEY } from './settings';
import { DARK_PALETTE_CLASS, provideAppSettings } from './settings.providers';
import { SettingsStore } from './settings.store';
import {
  createMemoryStorage,
  KEY_VALUE_STORAGE,
  type KeyValueStorage,
} from './storage';

describe('provideAppSettings', () => {
  const systemDark = signal(false);

  async function bootstrap(stored?: string, storage?: KeyValueStorage) {
    TestBed.configureTestingModule({
      providers: [
        provideAppI18n(),
        provideAppSettings(),
        { provide: ErrorHandler, useValue: { handleError: vi.fn() } },
        {
          provide: KEY_VALUE_STORAGE,
          useValue:
            storage ??
            createMemoryStorage(
              stored ? { [SETTINGS_STORAGE_KEY]: stored } : {},
            ),
        },
        { provide: DEVICE_LANGUAGES, useValue: ['en'] },
        { provide: SYSTEM_PREFERS_DARK, useValue: systemDark.asReadonly() },
      ],
    });
    // Wait for the app initializers, like a real bootstrap does.
    await TestBed.inject(ApplicationInitStatus).donePromise;
    const root = TestBed.inject(DOCUMENT).documentElement;
    const settle = async () => {
      TestBed.tick();
      await TestBed.inject(ApplicationRef).whenStable();
    };
    return {
      root,
      settle,
      store: TestBed.inject(SettingsStore),
      transloco: TestBed.inject(TranslocoService),
    };
  }

  afterEach(() => {
    systemDark.set(false);
    document.documentElement.classList.remove(DARK_PALETTE_CLASS);
  });

  it('applies persisted settings before the first render', async () => {
    const { root, transloco, settle } = await bootstrap(
      '{"theme":"dark","locale":"ru"}',
    );
    await settle();

    expect(root.classList.contains(DARK_PALETTE_CLASS)).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    expect(root.lang).toBe('ru');
    expect(transloco.getActiveLang()).toBe('ru');
    expect(transloco.translate('tabs.home')).toBe('Главная');
  });

  it('still starts, with defaults, when stored settings cannot be read', async () => {
    const failing: KeyValueStorage = {
      get: async () => Promise.reject(new Error('blocked')),
      set: async () => undefined,
      remove: async () => undefined,
    };
    const { root, transloco, settle } = await bootstrap(undefined, failing);
    await settle();

    expect(TestBed.inject(ApplicationInitStatus).done).toBe(true);
    expect(root.lang).toBe('en');
    expect(transloco.translate('tabs.home')).toBe('Home');
    expect(TestBed.inject(ErrorHandler).handleError).toHaveBeenCalled();
  });

  it('switches the dark palette on and off', async () => {
    const { root, store, settle } = await bootstrap();
    await settle();
    expect(root.classList.contains(DARK_PALETTE_CLASS)).toBe(false);

    store.setTheme('dark');
    await settle();
    expect(root.classList.contains(DARK_PALETTE_CLASS)).toBe(true);

    store.setTheme('system');
    await settle();
    expect(root.classList.contains(DARK_PALETTE_CLASS)).toBe(false);

    systemDark.set(true);
    await settle();
    expect(root.classList.contains(DARK_PALETTE_CLASS)).toBe(true);
  });

  it('switches the document and UI language', async () => {
    const { root, store, transloco, settle } = await bootstrap();
    await settle();
    expect(root.lang).toBe('en');

    store.setLocale('ru');
    await settle();
    expect(root.lang).toBe('ru');
    expect(transloco.getActiveLang()).toBe('ru');
  });
});
