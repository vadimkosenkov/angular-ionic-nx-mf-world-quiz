import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { BundledTranslationLoader, provideAppI18n } from './i18n.providers';

describe('provideAppI18n', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideAppI18n()] });
  });

  it('offers exactly the app languages with English as default and fallback', () => {
    const transloco = TestBed.inject(TranslocoService);
    expect(transloco.getAvailableLangs()).toEqual(['en', 'ru']);
    expect(transloco.getDefaultLang()).toBe('en');
  });

  it('translates in both languages without any HTTP request', async () => {
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('ru'));
    await firstValueFrom(transloco.load('en'));

    expect(transloco.translate('tabs.settings', {}, 'en')).toBe('Settings');
    expect(transloco.translate('tabs.settings', {}, 'ru')).toBe('Настройки');
    expect(
      transloco.translate('common.progressValue', { value: 3, max: 195 }, 'ru'),
    ).toBe('3 из 195');
  });

  it('rejects unsupported languages in the loader', () => {
    expect(() =>
      TestBed.inject(BundledTranslationLoader).getTranslation('de'),
    ).toThrow('Unsupported language "de"');
  });
});
