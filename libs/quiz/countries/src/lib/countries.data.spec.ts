import type { Country, QuizCategory, Region } from '@world-quiz/quiz/domain';
import {
  buildAnswerIndex,
  countriesInScope,
  displayAnswer,
  LOCALES,
  matchAnswer,
  normalizeAnswer,
  REGIONS,
  validateDataset,
} from '@world-quiz/quiz/domain';
import { COUNTRIES } from './countries.data';

const byCode = new Map(COUNTRIES.map((country) => [country.code, country]));
const get = (code: string) => byCode.get(code) as Country;
const CATEGORIES: readonly QuizCategory[] = ['capitals', 'flags'];

describe('country scope', () => {
  it('contains exactly 195 countries: 193 UN members + Vatican City + Palestine', () => {
    expect(COUNTRIES).toHaveLength(195);
    expect(get('va').name.en).toBe('Vatican City');
    expect(get('ps').name.en).toBe('Palestine');
  });

  it.each(['xk', 'tw', 'eh'])(
    'excludes the documented ambiguity %s',
    (code) => {
      expect(byCode.has(code)).toBe(false);
    },
  );

  it('passes structural validation', () => {
    expect(validateDataset(COUNTRIES)).toEqual([]);
  });

  it('is sorted by English name for easy maintenance', () => {
    const names = COUNTRIES.map((country) => country.name.en);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });
});

describe('regions (UN M49)', () => {
  it.each<[Region, number]>([
    ['europe', 44],
    ['asia', 48],
    ['africa', 54],
    ['north-america', 23],
    ['south-america', 12],
    ['oceania', 14],
  ])('%s has %i countries', (region, count) => {
    expect(countriesInScope(COUNTRIES, region)).toHaveLength(count);
  });

  it('assigns every country to exactly one region', () => {
    const total = REGIONS.reduce(
      (sum, region) => sum + countriesInScope(COUNTRIES, region).length,
      0,
    );
    expect(total).toBe(COUNTRIES.length);
  });

  it.each<[string, Region]>([
    ['ru', 'europe'], // transcontinental, M49 Eastern Europe
    ['tr', 'asia'], // M49 Western Asia
    ['cy', 'asia'], // M49 Western Asia
    ['kz', 'asia'],
    ['eg', 'africa'],
    ['mx', 'north-america'], // Central America belongs to North America
    ['jm', 'north-america'], // so does the Caribbean
    ['co', 'south-america'],
    ['pg', 'oceania'],
  ])('classifies %s as %s', (code, region) => {
    expect(get(code).region).toBe(region);
  });
});

describe('display values', () => {
  it.each(
    CATEGORIES.flatMap((category) =>
      LOCALES.map((locale) => [category, locale] as const),
    ),
  )(
    '%s answers are unique per locale (%s), so Easy choices never repeat a label',
    (category, locale) => {
      const keys = COUNTRIES.map((country) =>
        normalizeAnswer(displayAnswer(country, category, locale)),
      );
      const duplicates = keys.filter(
        (key, index) => keys.indexOf(key) !== index,
      );
      expect(duplicates).toEqual([]);
    },
  );

  it.each([
    ['us', 'Washington, D.C.', 'Вашингтон'],
    ['ru', 'Moscow', 'Москва'],
    ['ua', 'Kyiv', 'Киев'],
    ['bo', 'Sucre', 'Сукре'],
    ['za', 'Pretoria', 'Претория'],
    ['ps', 'Ramallah', 'Рамалла'],
    ['gq', 'Malabo', 'Малабо'],
    ['id', 'Jakarta', 'Джакарта'],
    ['nr', 'Yaren', 'Ярен'],
  ])('%s capital is %s / %s', (code, en, ru) => {
    expect(get(code).capital).toEqual({ en, ru });
  });
});

describe('accepted answers', () => {
  it.each(CATEGORIES)('never overlap between countries (%s)', (category) => {
    const index = buildAnswerIndex(COUNTRIES, category);
    const shared = [...index.countriesByKey].filter(
      ([, codes]) => codes.length > 1,
    );
    expect(shared).toEqual([]);
  });

  it.each(CATEGORIES)(
    '%s: every display value is correct for its own country and wrong for every other',
    (category) => {
      const index = buildAnswerIndex(COUNTRIES, category);
      for (const answeredCountry of COUNTRIES) {
        for (const locale of LOCALES) {
          const text = displayAnswer(answeredCountry, category, locale);
          for (const asked of COUNTRIES) {
            const result = matchAnswer(index, asked.code, text);
            const expected =
              asked.code === answeredCountry.code ? 'exact' : 'incorrect';
            if (result.kind !== expected) {
              throw new Error(
                `${category}: "${text}" for ${asked.code} gave ${result.kind}, expected ${expected}`,
              );
            }
          }
        }
      }
    },
  );
});

describe('Hard-mode matching on the real dataset', () => {
  const capitals = buildAnswerIndex(COUNTRIES, 'capitals');
  const names = buildAnswerIndex(COUNTRIES, 'flags');

  it.each([
    // exact, including aliases and spelling variants
    ['ua', 'Kiev', 'exact'],
    ['ua', 'киев', 'exact'],
    ['us', 'Washington', 'exact'],
    ['bo', 'La Paz', 'exact'],
    ['lk', 'Colombo', 'exact'],
    ['za', 'Кейптаун', 'exact'],
    ['in', 'New Delhi', 'exact'],
    ['in', 'Нью Дели', 'exact'],
    ['is', 'Reykjavik', 'exact'],
    ['co', 'Bogota', 'exact'],
    ['md', 'Кишинев', 'exact'],
    ['ag', 'Saint Johns', 'exact'],
    ['gd', "St George's", 'exact'],
    ['mn', 'Ulan Bator', 'exact'],
    ['ar', 'Буэнос Айрес', 'exact'],
    // typos
    ['fr', 'Pariss', 'typo'],
    ['ar', 'Buenos Aries', 'typo'],
    ['br', 'Brazilia', 'typo'],
    ['kh', 'Pnom Penh', 'typo'],
    ['au', 'Canbera', 'typo'],
    ['ua', 'Kyev', 'typo'],
    // plausible but wrong
    ['au', 'Sydney', 'incorrect'],
    ['br', 'Rio de Janeiro', 'incorrect'],
    ['tr', 'Istanbul', 'incorrect'],
    ['ca', 'Toronto', 'incorrect'],
    ['ch', 'Zurich', 'incorrect'],
    ['in', 'Mumbai', 'incorrect'],
    ['ng', 'Lagos', 'incorrect'],
    ['tz', 'Dar es Salaam', 'incorrect'],
    ['kz', 'Almaty', 'incorrect'],
    ['il', 'Tel Aviv', 'incorrect'],
    ['nl', 'The Hague', 'incorrect'],
    ['ru', 'Санкт-Петербург', 'incorrect'],
    ['ru', 'Moskva', 'incorrect'],
  ] as const)('capital of %s: %j → %s', (code, input, kind) => {
    expect(matchAnswer(capitals, code, input).kind).toBe(kind);
  });

  it.each([
    ['us', 'USA', 'exact'],
    ['us', 'Америка', 'exact'],
    ['gb', 'Great Britain', 'exact'],
    ['cz', 'Czech Republic', 'exact'],
    ['ci', 'Ivory Coast', 'exact'],
    ['ci', "Cote d'Ivoire", 'exact'],
    ['mm', 'Бирма', 'exact'],
    ['by', 'Белоруссия', 'exact'],
    ['cd', 'DRC', 'exact'],
    ['tr', 'Turkiye', 'exact'],
    ['ph', 'Phillipines', 'typo'],
    ['ch', 'Switzerlnd', 'typo'],
    ['ir', 'Iraq', 'incorrect'],
    ['ne', 'Nigeria', 'incorrect'],
    ['ss', 'Sudan', 'incorrect'],
    ['do', 'Dominica', 'incorrect'],
    ['gw', 'Guinea', 'incorrect'],
    ['cd', 'Congo', 'incorrect'],
    ['kr', 'Korea', 'incorrect'],
    ['ml', 'Malawi', 'incorrect'],
    ['sk', 'Slovenia', 'incorrect'],
    ['at', 'Australia', 'incorrect'],
    ['gm', 'Zambia', 'incorrect'],
    ['gy', 'Ghana', 'incorrect'],
  ] as const)('country %s: %j → %s', (code, input, kind) => {
    expect(matchAnswer(names, code, input).kind).toBe(kind);
  });
});
