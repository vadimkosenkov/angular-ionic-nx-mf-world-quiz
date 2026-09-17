import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import type { Country } from './country';
import {
  acceptedAnswers,
  countriesInScope,
  displayAnswer,
  indexCountriesByCode,
  validateDataset,
} from './country';

const bolivia = FIXTURE_DATASET.find(
  (country) => country.code === 'bo',
) as Country;

describe('countriesInScope', () => {
  it('returns the whole dataset for World', () => {
    expect(countriesInScope(FIXTURE_DATASET, 'world')).toBe(FIXTURE_DATASET);
  });

  it('filters by region, keeping dataset order', () => {
    expect(
      countriesInScope(FIXTURE_DATASET, 'south-america').map((c) => c.code),
    ).toEqual(['bo', 'br']);
  });
});

describe('indexCountriesByCode', () => {
  it('looks countries up by code', () => {
    expect(indexCountriesByCode(FIXTURE_DATASET).get('bo')).toBe(bolivia);
  });
});

describe('displayAnswer', () => {
  it('shows the capital for Capitals and the name for Flags, per locale', () => {
    expect(displayAnswer(bolivia, 'capitals', 'en')).toBe('Sucre');
    expect(displayAnswer(bolivia, 'capitals', 'ru')).toBe('Сукре');
    expect(displayAnswer(bolivia, 'flags', 'ru')).toBe('Боливия');
  });
});

describe('acceptedAnswers', () => {
  it('lists display values first, then aliases, for all locales', () => {
    expect(acceptedAnswers(bolivia, 'capitals')).toEqual([
      'Sucre',
      'Сукре',
      'La Paz',
      'Ла-Пас',
    ]);
    expect(acceptedAnswers(bolivia, 'flags')).toEqual(['Bolivia', 'Боливия']);
  });
});

describe('validateDataset', () => {
  const valid: Country = {
    code: 'fr',
    region: 'europe',
    subregion: 'western-europe',
    name: { en: 'France', ru: 'Франция' },
    capital: { en: 'Paris', ru: 'Париж' },
  };

  it('accepts a well-formed dataset', () => {
    expect(validateDataset(FIXTURE_DATASET)).toEqual([]);
  });

  it.each<[string, Partial<Country>, string]>([
    ['uppercase code', { code: 'FR' }, 'code must be'],
    ['alpha-3 code', { code: 'fra' }, 'code must be'],
    [
      'subregion from another region',
      { subregion: 'eastern-asia' },
      'does not belong to region',
    ],
    ['empty English name', { name: { en: ' ', ru: 'Франция' } }, 'name.en'],
    ['Latin Russian name', { name: { en: 'France', ru: 'France' } }, 'name.ru'],
    [
      'Cyrillic English capital',
      { capital: { en: 'Париж', ru: 'Париж' } },
      'capital.en',
    ],
    ['blank alias', { capitalAliases: { en: [''] } }, 'blank'],
    [
      'Latin Russian alias',
      { nameAliases: { ru: ['Frantsiya'] } },
      'nameAliases.ru',
    ],
  ])('reports %s', (_, override, message) => {
    const issues = validateDataset([{ ...valid, ...override }]);
    expect(issues.map((issue) => issue.message).join('\n')).toContain(message);
  });

  it('reports duplicate codes', () => {
    expect(validateDataset([valid, valid])).toEqual([
      { code: 'fr', message: 'duplicate code' },
    ]);
  });
});
