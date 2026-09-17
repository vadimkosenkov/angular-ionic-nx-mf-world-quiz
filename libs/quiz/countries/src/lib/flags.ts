import type { CountryCode } from '@world-quiz/quiz/domain';

/**
 * Flags are SVG files from the `flag-icons` package (MIT), 4:3 variant.
 * They are bundled into each app at build time, so no network is needed.
 *
 * Apps copy the files with an asset rule such as:
 *   { "glob": "*.svg", "input": "node_modules/flag-icons/flags/4x3", "output": "flags" }
 * and then reference them with `flagAssetPath(code)`.
 */
export const FLAG_ICONS_SOURCE_DIRECTORY = 'node_modules/flag-icons/flags/4x3';

/** Folder, relative to an app's base href, that the flag files are copied to. */
export const FLAG_ASSET_DIRECTORY = 'flags';

/** Relative URL of a country's flag, e.g. `flags/fr.svg`. */
export function flagAssetPath(code: CountryCode): string {
  return `${FLAG_ASSET_DIRECTORY}/${code}.svg`;
}
