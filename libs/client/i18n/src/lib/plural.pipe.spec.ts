import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { provideAppI18n } from './i18n.providers';
import { pluralCategory, PluralPipe } from './plural.pipe';

describe('pluralCategory', () => {
  it.each([
    ['en', 1, 'one'],
    ['en', 2, 'other'],
    ['en', 195, 'other'],
    ['ru', 1, 'one'],
    ['ru', 21, 'one'],
    ['ru', 2, 'few'],
    ['ru', 54, 'few'],
    ['ru', 5, 'many'],
    ['ru', 11, 'many'],
    ['ru', 195, 'many'],
    ['ru', 1.5, 'other'],
  ] as const)('%s %s → %s', (lang, count, expected) => {
    expect(pluralCategory(lang, count)).toBe(expected);
  });
});

describe('PluralPipe with the bundled translations', () => {
  let transloco: TranslocoService;
  let pipe: PluralPipe;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideAppI18n(), PluralPipe],
    });
    transloco = TestBed.inject(TranslocoService);
    pipe = TestBed.inject(PluralPipe);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('ru'));
  });

  it('uses English forms', () => {
    transloco.setActiveLang('en');
    expect(pipe.transform('counts.countries', 1)).toBe('1 country');
    expect(pipe.transform('counts.countries', 195)).toBe('195 countries');
  });

  it('uses Russian forms and follows language changes', () => {
    transloco.setActiveLang('ru');
    expect(pipe.transform('counts.countries', 195)).toBe('195 стран');
    expect(pipe.transform('counts.countries', 54)).toBe('54 страны');
    expect(pipe.transform('counts.regions', 6)).toBe('6 регионов');
    expect(pipe.transform('counts.regions', 1)).toBe('1 регион');
  });
});
