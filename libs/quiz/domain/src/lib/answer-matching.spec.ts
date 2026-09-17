import { FIXTURE_DATASET } from '../testing/fixture-dataset';
import {
  boundedEditDistance,
  buildAnswerIndex,
  matchAnswer,
  normalizeAnswer,
  typoTolerance,
} from './answer-matching';

describe('normalizeAnswer', () => {
  it.each([
    // case
    ['PARIS', 'paris'],
    ['pArIs', 'paris'],
    // leading/trailing and repeated whitespace, tabs, non-breaking space
    ['   Paris  ', 'paris'],
    ['New\t\tDelhi', 'newdelhi'],
    ['Port\u00a0Louis', 'portlouis'], // non-breaking space
    // hyphens and dashes split words; the key has no spaces
    ['Port-au-Prince', 'portauprince'],
    ['port au prince', 'portauprince'],
    ['Папуа — Новая Гвинея', 'папуановаягвинея'],
    // apostrophes and dots join
    ["N'Djamena", 'ndjamena'],
    ['N’Djamena', 'ndjamena'],
    ['Nukuʻalofa', 'nukualofa'],
    ['Washington, D.C.', 'washingtondc'],
    ['Кот-д’Ивуар', 'котдивуар'],
    // diacritics (Unicode NFC and NFD input)
    ['Brasília', 'brasilia'],
    ['Chișinău', 'chisinau'],
    ['Sa\u0303o Tome\u0301', 'saotome'], // decomposed (NFD) input
    // Russian: ё equals е, й is preserved
    ['Кишинёв', 'кишинев'],
    ['КИШИНЕВ', 'кишинев'],
    ['Нукуалофа', 'нукуалофа'],
    ['Ниамей', 'ниамей'],
    // stop words and abbreviations
    ['The Gambia', 'gambia'],
    ['Bosnia & Herzegovina', 'bosniaherzegovina'],
    ['Bosnia and Herzegovina', 'bosniaherzegovina'],
    ['Антигуа и Барбуда', 'антигуабарбуда'],
    ["St. John's", 'saintjohns'],
    ["Saint John's", 'saintjohns'],
    // punctuation only / empty
    ['  ?!  ', ''],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeAnswer(input)).toBe(expected);
  });
});

describe('boundedEditDistance', () => {
  it.each([
    ['paris', 'paris', 0],
    ['pariss', 'paris', 1], // insertion
    ['pars', 'paris', 1], // deletion
    ['parus', 'paris', 1], // substitution
    ['prais', 'paris', 1], // adjacent transposition counts as one edit
    ['vienna', 'veinna', 1],
    ['', 'abc', 3],
  ])('distance(%s, %s) = %i', (a, b, expected) => {
    expect(boundedEditDistance(a, b, 5)).toBe(expected);
    expect(boundedEditDistance(b, a, 5)).toBe(expected);
  });

  it('returns max + 1 as soon as the bound is exceeded', () => {
    expect(boundedEditDistance('paris', 'london', 1)).toBe(2);
    expect(boundedEditDistance('a', 'abcdef', 2)).toBe(3);
  });
});

describe('typoTolerance', () => {
  it.each([
    [1, 0],
    [3, 0],
    [4, 1],
    [7, 1],
    [8, 2],
    [12, 2],
    [13, 3],
    [30, 3],
  ])('length %i tolerates %i edits', (length, tolerance) => {
    expect(typoTolerance(length)).toBe(tolerance);
  });
});

describe('matchAnswer', () => {
  const capitals = buildAnswerIndex(FIXTURE_DATASET, 'capitals');
  const countries = buildAnswerIndex(FIXTURE_DATASET, 'flags');

  describe('accepts correct answers exactly', () => {
    it.each([
      // valid answers
      ['fr', 'Paris', 'Paris'],
      ['td', "N'Djamena", "N'Djamena"],
      // localized answers (either language is accepted in any UI language)
      ['fr', 'Париж', 'Париж'],
      ['ru', 'Москва', 'Москва'],
      ['ru', 'Moscow', 'Moscow'],
      ['md', 'Кишинев', 'Кишинёв'],
      // capitalization and whitespace
      ['fr', '  pARIS ', 'Paris'],
      ['ht', 'port   au   prince', 'Port-au-Prince'],
      // punctuation and diacritics
      ['br', 'Brasilia', 'Brasília'],
      ['md', 'Chisinau', 'Chișinău'],
      ['td', 'Ndjamena', "N'Djamena"],
      ['to', "Nuku'alofa", 'Nukuʻalofa'],
      ['us', 'washington dc', 'Washington, D.C.'],
      // documented aliases and other legitimate capitals
      ['us', 'Washington', 'Washington'],
      ['ch', 'Berne', 'Berne'],
      ['bo', 'La Paz', 'La Paz'],
      ['bo', 'ла пас', 'Ла-Пас'],
      ['za', 'Cape Town', 'Cape Town'],
    ])('%s: %j', (code, input, matchedText) => {
      expect(matchAnswer(capitals, code, input)).toEqual({
        kind: 'exact',
        matchedText,
      });
    });

    it.each([
      ['us', 'USA', 'USA'],
      ['us', 'соединенные штаты америки', 'Соединённые Штаты Америки'],
      ['za', 'ЮАР', 'ЮАР'],
      ['gm', 'the gambia', 'Gambia'],
      ['kn', 'Saint Kitts & Nevis', 'Saint Kitts and Nevis'],
      ['kn', 'St Kitts and Nevis', 'Saint Kitts and Nevis'],
      ['md', 'Молдавия', 'Молдавия'],
    ])('country names %s: %j', (code, input, matchedText) => {
      expect(matchAnswer(countries, code, input)).toEqual({
        kind: 'exact',
        matchedText,
      });
    });
  });

  describe('tolerates reasonable typos', () => {
    it.each([
      ['fr', 'Pariss', 'Paris', 1], // extra letter
      ['fr', 'Pars', 'Paris', 1], // missing letter
      ['fr', 'Parsi', 'Paris', 1], // swapped letters
      ['at', 'Viena', 'Vienna', 1], // missing double letter
      ['au', 'Canbera', 'Canberra', 1],
      ['sk', 'Bratislawa', 'Bratislava', 1], // keyboard neighbour
      ['si', 'Lubljana', 'Ljubljana', 1],
      ['ng', 'Abuha', 'Abuja', 1],
      ['za', 'Pretorea', 'Pretoria', 1],
      ['ru', 'Моска', 'Москва', 1], // Russian typo
      ['iq', 'Багдат', 'Багдад', 1],
      ['to', 'Nukualofaa', 'Nukuʻalofa', 1],
      ['ht', 'Port-au-Prence', 'Port-au-Prince', 1],
      ['kn', 'Basetere', 'Basseterre', 2], // longer names tolerate two edits
    ])('%s: %j → %s', (code, input, matchedText, distance) => {
      expect(matchAnswer(capitals, code, input)).toEqual({
        kind: 'typo',
        matchedText,
        distance,
      });
    });

    it('accepts a typo in a country name that is still closest to the correct country', () => {
      expect(matchAnswer(countries, 'gm', 'Gambai')).toEqual({
        kind: 'typo',
        matchedText: 'Gambia',
        distance: 1,
      });
    });
  });

  describe('rejects incorrect answers', () => {
    it.each([
      ['fr', 'London'],
      ['fr', 'Lyon'],
      ['fr', 'Pa'],
      ['fr', 'Parisian quarter'],
      ['it', 'Roma city'],
      ['jp', 'Kyoto'],
      ['fr', 'Pqrjs'], // too many edits
      ['ru', 'Мск'],
      ['bo', 'Santa Cruz'],
      ['us', 'New York'],
      ['ch', 'Zurich'],
    ])('%s: %j', (code, input) => {
      expect(matchAnswer(capitals, code, input).kind).toBe('incorrect');
    });

    it('treats another country’s capital as wrong and reports which one', () => {
      expect(matchAnswer(capitals, 'fr', 'Berlin')).toEqual({
        kind: 'incorrect',
        matchedCountryCode: 'de',
      });
      expect(matchAnswer(capitals, 'de', 'Bern')).toEqual({
        kind: 'incorrect',
        matchedCountryCode: 'ch',
      });
    });

    it.each([
      ['ir', 'Iraq'], // exact other country, 1 edit away
      ['iq', 'Iran'],
      ['gm', 'Zambia'],
      ['zm', 'Gambia'],
      ['ne', 'Nigeria'],
      ['ng', 'Niger'],
      ['at', 'Australia'],
      ['au', 'Austria'],
      ['sk', 'Slovenia'],
      ['si', 'Slovakia'],
    ])('look-alike country names: %s is not %j', (code, input) => {
      expect(matchAnswer(countries, code, input)).toMatchObject({
        kind: 'incorrect',
      });
    });

    it('rejects a typo that is as close to another country as to the correct one', () => {
      // "Iram" is one edit from both Iran and Iraq.
      expect(matchAnswer(countries, 'ir', 'Iram').kind).toBe('incorrect');
      // "Nigera" is one edit from Nigeria but also close to Niger.
      expect(matchAnswer(countries, 'ne', 'Nigera').kind).toBe('incorrect');
    });

    it('allows no typos in answers of three letters or fewer', () => {
      expect(matchAnswer(capitals, 'it', 'Рин').kind).toBe('incorrect'); // Рим
      expect(matchAnswer(countries, 'td', 'Чат').kind).toBe('incorrect'); // Чад
      expect(matchAnswer(countries, 'us', 'СЩА').kind).toBe('incorrect'); // США
    });

    it('allows one typo from four letters on', () => {
      expect(matchAnswer(capitals, 'it', 'Rom').kind).toBe('typo'); // Rome
      expect(matchAnswer(countries, 'td', 'Chat').kind).toBe('typo'); // Chad
      expect(matchAnswer(capitals, 'fr', 'Pari').kind).toBe('typo'); // Paris
    });

    it.each(['', '   ', '...', '!!!'])(
      'blank or symbol-only input %j',
      (input) => {
        expect(matchAnswer(capitals, 'fr', input)).toEqual({
          kind: 'incorrect',
        });
      },
    );
  });
});

describe('buildAnswerIndex', () => {
  it('contains every display value and alias once per country', () => {
    const index = buildAnswerIndex(FIXTURE_DATASET, 'capitals');
    const bolivia = index.entries
      .filter((entry) => entry.countryCode === 'bo')
      .map((entry) => entry.text);

    expect(bolivia).toEqual(['Sucre', 'Сукре', 'La Paz', 'Ла-Пас']);
  });

  it('skips aliases that normalize to an existing key', () => {
    const index = buildAnswerIndex(
      [
        {
          code: 'xx',
          region: 'europe',
          subregion: 'western-europe',
          name: { en: 'Example', ru: 'Пример' },
          capital: { en: 'Saint Town', ru: 'Город' },
          capitalAliases: { en: ['St. Town', 'ST TOWN'] },
        },
      ],
      'capitals',
    );

    expect(index.entries.map((entry) => entry.text)).toEqual([
      'Saint Town',
      'Город',
    ]);
  });
});
