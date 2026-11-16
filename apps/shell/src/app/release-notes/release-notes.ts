import type { Locale } from '@world-quiz/quiz/domain';
import notes from './releases.json';

/**
 * What changed in each release, in the player's language.
 *
 * The notes are part of the bundle rather than something the API serves:
 * they describe the code they ship with, so a release can never claim a
 * change the running build does not have, and the page works offline, in
 * the iPhone bundle and on a deployment with no API at all.
 *
 * They are not translations in `client/i18n` either: the shape there is
 * fixed and checked (`TranslationShape`), while this list grows with every
 * release.
 *
 * The data is **JSON**, not TypeScript, because `npm run release` rewrites
 * it: it moves the `unreleased` lines into a dated entry and clears them
 * (docs/deployment/releasing.md). A script that had to edit a TypeScript
 * literal would be a regex away from breaking the app. What types cannot
 * check about hand-written data, a test over this very file does
 * (release-notes.spec.ts).
 *
 * A note is written for the player, in the same breath as the change itself
 * (CLAUDE.md): "a finished run can be shared as a picture", not "Phase 23:
 * `wq-dialog`".
 */
export interface ReleaseLines {
  readonly en: readonly string[];
  readonly ru: readonly string[];
}

export interface Release {
  /** `major.minor`, the series the build calls itself (app-info.ts). */
  readonly version: string;
  /** The day it was published, as `YYYY-MM-DD`. */
  readonly date: string;
  readonly lines: ReleaseLines;
}

/** Newest first: the order the page shows them in. */
export const RELEASES: readonly Release[] = parseReleases(notes.releases);

/**
 * Reads the entries defensively, the way stored settings are read: a
 * malformed one is left out rather than throwing, because a typo in a note
 * must not be able to stop the app from starting. The test over the real
 * file is what catches the typo.
 */
export function parseReleases(value: unknown): readonly Release[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Release => isRelease(entry))
    .map((release) => ({
      version: release.version,
      date: release.date,
      lines: { en: [...release.lines.en], ru: [...release.lines.ru] },
    }))
    .sort((a, b) => compareVersions(b.version, a.version));
}

function isRelease(value: unknown): value is Release {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const lines = entry['lines'];
  return (
    typeof entry['version'] === 'string' &&
    /^\d+\.\d+$/.test(entry['version']) &&
    typeof entry['date'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry['date']) &&
    isLines(lines)
  );
}

function isLines(value: unknown): value is ReleaseLines {
  if (typeof value !== 'object' || value === null) return false;
  const lines = value as Record<string, unknown>;
  return isTextArray(lines['en']) && isTextArray(lines['ru']);
}

function isTextArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((line) => typeof line === 'string' && line.trim().length > 0)
  );
}

/**
 * Compares two `major.minor` versions the way a release series is ordered.
 * Anything unparsable sorts as the oldest, so a damaged value can only ever
 * make the app show a note again — never hide one.
 */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  return left[0] - right[0] || left[1] - right[1];
}

function versionParts(version: string): readonly [number, number] {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  const number = (index: number): number => {
    const part = parts[index];
    return part !== undefined && Number.isFinite(part) ? part : -1;
  };
  return [number(0), number(1)];
}

/** The release the running build is, or `null` before the first one. */
export function latestRelease(
  releases: readonly Release[] = RELEASES,
): Release | null {
  return (
    releases.reduce<Release | null>(
      (latest, release) =>
        !latest || compareVersions(release.version, latest.version) > 0
          ? release
          : latest,
      null,
    ) ?? null
  );
}

/**
 * Whether there is a release the player has not read yet.
 *
 * A device that has never stored anything is **not** behind: the player is
 * either new or has just arrived from a build without this screen, and
 * being invited to read what changed before having seen anything at all
 * says nothing to them (notifications.store.ts stores the current release
 * on the first run instead).
 */
export function hasUnreadRelease(
  seen: string | null,
  releases: readonly Release[] = RELEASES,
): boolean {
  const latest = latestRelease(releases);
  if (!latest || !seen) return false;
  return compareVersions(latest.version, seen) > 0;
}

/**
 * The day a release is dated, written the way the language writes a date.
 *
 * `timeZone: 'UTC'` is the whole point: the stored value is a calendar day,
 * not a moment, and it is read as UTC midnight. Formatted in the device's
 * own zone, a release dated the 13th would be shown as the 12th to every
 * player west of UTC — the release did not happen on a different day for
 * them.
 */
export function releaseDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The lines of a release in one language; English is the fallback. */
export function releaseLines(
  release: Release,
  locale: Locale,
): readonly string[] {
  const lines = release.lines[locale];
  return lines.length > 0 ? lines : release.lines.en;
}
