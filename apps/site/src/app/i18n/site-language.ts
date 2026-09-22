/** The languages of the site; every page exists in each, under `/<lang>/`. */
export const SITE_LANGUAGES = ['en', 'ru'] as const;
export type SiteLanguage = (typeof SITE_LANGUAGES)[number];

export function isSiteLanguage(value: unknown): value is SiteLanguage {
  return (SITE_LANGUAGES as readonly unknown[]).includes(value);
}

/**
 * The visitor's language from an `Accept-Language` header, e.g.
 * `ru-RU,ru;q=0.9,en;q=0.8` → `ru`. Weights are honoured; anything not
 * offered falls back to English.
 */
export function preferredLanguage(header: string | undefined): SiteLanguage {
  const ranked = (header ?? '')
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const weight = params
        .map((param) => /^\s*q=([\d.]+)\s*$/.exec(param)?.[1])
        .find((value) => value !== undefined);
      return {
        language: tag.toLowerCase().split('-')[0],
        weight: weight === undefined ? 1 : Number(weight),
        index,
      };
    })
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return ranked.map((entry) => entry.language).find(isSiteLanguage) ?? 'en';
}
