import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { COUNTRIES } from './countries.data';
import { FLAG_ICONS_SOURCE_DIRECTORY, flagAssetPath } from './flags';

const flagIconsRoot = dirname(
  createRequire(import.meta.url).resolve('flag-icons/package.json'),
);
const flagsDirectory = join(
  flagIconsRoot,
  FLAG_ICONS_SOURCE_DIRECTORY.replace('node_modules/flag-icons/', ''),
);

describe('flags', () => {
  it('builds a relative asset path', () => {
    expect(flagAssetPath('fr')).toBe('flags/fr.svg');
  });

  it('points at the directory the apps copy flags from', () => {
    expect(FLAG_ICONS_SOURCE_DIRECTORY).toBe(
      'node_modules/flag-icons/flags/4x3',
    );
    expect(existsSync(flagsDirectory)).toBe(true);
  });

  it.each(COUNTRIES.map((country) => country.code))(
    'bundles a non-empty SVG flag for %s',
    (code) => {
      const file = join(flagsDirectory, `${code}.svg`);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file, 'utf8')).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
    },
  );
});
