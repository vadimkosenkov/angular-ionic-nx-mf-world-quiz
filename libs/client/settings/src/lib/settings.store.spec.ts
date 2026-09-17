import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEVICE_LANGUAGES, SYSTEM_PREFERS_DARK } from './environment';
import { SETTINGS_STORAGE_KEY } from './settings';
import { SettingsStore } from './settings.store';
import {
  createMemoryStorage,
  KEY_VALUE_STORAGE,
  type KeyValueStorage,
} from './storage';

function setup(
  options: {
    stored?: string;
    languages?: string[];
    storage?: KeyValueStorage;
  } = {},
) {
  const storage =
    options.storage ??
    createMemoryStorage(
      options.stored ? { [SETTINGS_STORAGE_KEY]: options.stored } : {},
    );
  const systemDark = signal(false);
  const errorHandler = { handleError: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: KEY_VALUE_STORAGE, useValue: storage },
      { provide: DEVICE_LANGUAGES, useValue: options.languages ?? ['en-US'] },
      { provide: SYSTEM_PREFERS_DARK, useValue: systemDark.asReadonly() },
      { provide: ErrorHandler, useValue: errorHandler },
    ],
  });
  return {
    store: TestBed.inject(SettingsStore),
    storage,
    systemDark,
    errorHandler,
  };
}

describe('SettingsStore', () => {
  it('defaults to the System theme and the device language', () => {
    expect(setup({ languages: ['ru-RU', 'en'] }).store.locale()).toBe('ru');
    TestBed.resetTestingModule();
    const { store } = setup({ languages: ['fr-FR'] });
    expect(store.theme()).toBe('system');
    expect(store.locale()).toBe('en');
  });

  it('loads persisted settings', async () => {
    const { store } = setup({ stored: '{"theme":"dark","locale":"ru"}' });
    await store.load();
    expect(store.theme()).toBe('dark');
    expect(store.locale()).toBe('ru');
  });

  it('keeps defaults when stored settings are corrupted', async () => {
    const { store } = setup({ stored: '{oops', languages: ['ru'] });
    await store.load();
    expect(store.theme()).toBe('system');
    expect(store.locale()).toBe('ru');
  });

  it('applies changes immediately and persists them, last change winning', async () => {
    const { store, storage } = setup();
    store.setTheme('dark');
    store.setLocale('ru');
    store.setTheme('light');

    expect(store.theme()).toBe('light');
    await store.flush();
    expect(JSON.parse((await storage.get(SETTINGS_STORAGE_KEY)) ?? '')).toEqual(
      { theme: 'light', locale: 'ru' },
    );
  });

  it('follows the system appearance only while the preference is System', () => {
    const { store, systemDark } = setup();
    expect(store.colorScheme()).toBe('light');

    systemDark.set(true);
    expect(store.colorScheme()).toBe('dark');

    store.setTheme('light');
    expect(store.colorScheme()).toBe('light');
  });

  it('keeps the new value for the session and reports the error when saving fails', async () => {
    const failure = new Error('disk full');
    const { store, errorHandler } = setup({
      storage: {
        get: async () => null,
        set: async () => Promise.reject(failure),
        remove: async () => undefined,
      },
    });

    store.setTheme('dark');
    await store.flush();

    expect(store.theme()).toBe('dark');
    expect(errorHandler.handleError).toHaveBeenCalledWith(failure);
  });
});
