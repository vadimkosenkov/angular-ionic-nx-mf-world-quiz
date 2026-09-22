import { en } from './en';
import { ru } from './ru';
import { preferredLanguage } from './site-language';

describe('preferredLanguage', () => {
  it.each([
    ['ru-RU,ru;q=0.9,en;q=0.8', 'ru'],
    ['en-GB,en;q=0.9', 'en'],
    ['de-DE,de;q=0.9,ru;q=0.5,en;q=0.4', 'ru'],
    ['en;q=0.2, ru;q=0.8', 'ru'],
    ['ru;q=0, en', 'en'],
    ['fr', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ] as const)('picks %j → %s', (header, language) => {
    expect(preferredLanguage(header)).toBe(language);
  });
});

describe('site texts', () => {
  it('has a Russian text for every English one, and no empty text', () => {
    const shape = (value: unknown): unknown =>
      typeof value === 'function'
        ? 'function'
        : Array.isArray(value)
          ? 'array'
          : value && typeof value === 'object'
            ? Object.fromEntries(
                Object.entries(value).map(([key, inner]) => [
                  key,
                  shape(inner),
                ]),
              )
            : typeof value;
    expect(shape(ru)).toEqual(shape(en));

    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : value && typeof value === 'object'
          ? Object.values(value).flatMap(strings)
          : [];
    expect(
      [...strings(en), ...strings(ru)].filter((text) => !text.trim()),
    ).toEqual([]);
  });

  it('counts players with Russian plural forms', () => {
    expect([1, 3, 5, 21].map(ru.leaderboard.players)).toEqual([
      'В рейтинге 1 игрок',
      'В рейтинге 3 игрока',
      'В рейтинге 5 игроков',
      'В рейтинге 21 игрок',
    ]);
    expect(en.leaderboard.players(1)).toBe('1 player ranked');
  });
});
