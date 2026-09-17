import type { AppSettings } from './settings';
import {
  isThemePreference,
  parseStoredSettings,
  resolveColorScheme,
} from './settings';

const fallback: AppSettings = { theme: 'system', locale: 'en' };

describe('resolveColorScheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)(
    '%s with system dark=%s → %s',
    (preference, systemDark, expected) => {
      expect(resolveColorScheme(preference, systemDark)).toBe(expected);
    },
  );
});

describe('isThemePreference', () => {
  it.each(['light', 'dark', 'system'])('accepts %s', (value) =>
    expect(isThemePreference(value)).toBe(true),
  );
  it.each(['Dark', 'auto', '', null, 1])('rejects %o', (value) =>
    expect(isThemePreference(value)).toBe(false),
  );
});

describe('parseStoredSettings', () => {
  it('returns the fallback when nothing is stored', () => {
    expect(parseStoredSettings(null, fallback)).toBe(fallback);
  });

  it('reads valid settings', () => {
    expect(
      parseStoredSettings('{"theme":"dark","locale":"ru"}', fallback),
    ).toEqual({ theme: 'dark', locale: 'ru' });
  });

  it.each(['not json', '[]', '"dark"', 'null', '42'])(
    'ignores malformed value %j',
    (raw) => {
      expect(parseStoredSettings(raw, fallback)).toEqual(fallback);
    },
  );

  it('keeps valid fields and replaces invalid ones individually', () => {
    expect(
      parseStoredSettings('{"theme":"sepia","locale":"ru"}', fallback),
    ).toEqual({ theme: 'system', locale: 'ru' });
    expect(
      parseStoredSettings('{"theme":"light","locale":"de"}', fallback),
    ).toEqual({ theme: 'light', locale: 'en' });
  });
});
