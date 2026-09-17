import { en } from './en';
import { ru } from './ru';

type Tree = { readonly [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result.set(path, value);
    } else {
      for (const [nested, text] of flatten(value, path))
        result.set(nested, text);
    }
  }
  return result;
}

const placeholders = (text: string) =>
  [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();

const english = flatten(en);
const languages = { ru: flatten(ru) };

describe('translations', () => {
  it.each(Object.entries(languages))(
    '%s has exactly the English keys',
    (_, translation) => {
      expect([...translation.keys()].sort()).toEqual(
        [...english.keys()].sort(),
      );
    },
  );

  it.each(Object.entries({ en: english, ...languages }))(
    '%s has no empty texts',
    (_, translation) => {
      const empty = [...translation]
        .filter(([, text]) => !text.trim())
        .map(([key]) => key);
      expect(empty).toEqual([]);
    },
  );

  it.each(Object.entries(languages))(
    '%s uses the same placeholders as English',
    (_, translation) => {
      const mismatches = [...english]
        .filter(
          ([key, text]) =>
            placeholders(text).join() !==
            placeholders(translation.get(key) ?? '').join(),
        )
        .map(([key]) => key);
      expect(mismatches).toEqual([]);
    },
  );

  it('keeps Russian UI texts in Russian (only product names may be Latin)', () => {
    const allowedLatin = new Set([
      'app.name',
      'settings.about.dataValue',
      'settings.about.flagsValue',
    ]);
    const latinOnly = [...languages.ru]
      .map(([key, text]) => [key, text.replace(/{{\s*\w+\s*}}/g, '')] as const)
      .filter(
        ([key, text]) =>
          !allowedLatin.has(key) &&
          /\p{Script=Latin}/u.test(text) &&
          !/\p{Script=Cyrillic}/u.test(text),
      )
      .map(([key]) => key);
    expect(latinOnly).toEqual([]);
  });
});
