import { detectLocale } from './locale';

describe('detectLocale', () => {
  it.each([
    [['ru-RU', 'en-US'], 'ru'],
    [['en-GB'], 'en'],
    [['de-DE', 'ru'], 'ru'],
    [['RU'], 'ru'],
    [['uk-UA', 'fr-FR'], 'en'],
    [[], 'en'],
  ])('%j → %s', (preferred, expected) => {
    expect(detectLocale(preferred)).toBe(expected);
  });
});
