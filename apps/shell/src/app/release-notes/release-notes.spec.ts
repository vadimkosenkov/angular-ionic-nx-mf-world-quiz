import {
  compareVersions,
  hasUnreadRelease,
  latestRelease,
  parseReleases,
  type Release,
  RELEASES,
  releaseDate,
  releaseLines,
} from './release-notes';
import notes from './releases.json';

const release = (
  version: string,
  overrides: Partial<Release> = {},
): Release => ({
  version,
  date: '2026-11-13',
  lines: { en: [`English ${version}`], ru: [`Russian ${version}`] },
  ...overrides,
});

describe('release notes', () => {
  describe('compareVersions', () => {
    it('orders a release series', () => {
      expect(compareVersions('0.5', '0.4')).toBeGreaterThan(0);
      expect(compareVersions('1.0', '0.9')).toBeGreaterThan(0);
      expect(compareVersions('0.4', '0.4')).toBe(0);
      expect(compareVersions('0.10', '0.9')).toBeGreaterThan(0);
    });

    it('sorts a damaged version as the oldest, never the newest', () => {
      // The worst a broken stored value may do is show a note again.
      expect(compareVersions('0.1', 'nonsense')).toBeGreaterThan(0);
    });
  });

  describe('latestRelease', () => {
    it('is the highest version, whatever order the file is in', () => {
      expect(
        latestRelease([release('0.4'), release('0.6'), release('0.5')])
          ?.version,
      ).toBe('0.6');
    });

    it('is nothing before the first release', () => {
      expect(latestRelease([])).toBeNull();
    });
  });

  describe('hasUnreadRelease', () => {
    const releases = [release('0.5'), release('0.4')];

    it('is nothing to read on a device that has never stored anything', () => {
      // A new player, or one arriving from a build without this screen, is
      // not behind: notifications.store.ts stores the current release.
      expect(hasUnreadRelease(null, releases)).toBe(false);
    });

    it('is something to read when the build is newer than what was read', () => {
      expect(hasUnreadRelease('0.4', releases)).toBe(true);
    });

    it('is nothing to read once the newest release has been read', () => {
      expect(hasUnreadRelease('0.5', releases)).toBe(false);
    });

    it('is nothing to read on an older build than the one read on', () => {
      // A player who goes back to an older deployment is not shown a note
      // about a release this build does not have.
      expect(hasUnreadRelease('0.9', releases)).toBe(false);
    });
  });

  describe('releaseLines', () => {
    it('speaks the player language', () => {
      expect(releaseLines(release('0.4'), 'ru')).toEqual(['Russian 0.4']);
    });

    it('falls back to English rather than showing nothing', () => {
      const missing = release('0.4', {
        lines: { en: ['English only'], ru: [] },
      });
      expect(releaseLines(missing, 'ru')).toEqual(['English only']);
    });
  });

  describe('parseReleases', () => {
    it('sorts what it reads, newest first', () => {
      expect(
        parseReleases([release('0.4'), release('0.6')]).map((r) => r.version),
      ).toEqual(['0.6', '0.4']);
    });

    it('leaves out an entry it cannot trust instead of throwing', () => {
      const broken = [
        { version: '0.4', date: 'yesterday', lines: { en: ['x'], ru: ['y'] } },
        { version: 'nonsense', date: '2026-11-13', lines: { en: [], ru: [] } },
        { version: '0.5', date: '2026-11-13', lines: { en: ['x'] } },
        release('0.6'),
      ];
      expect(parseReleases(broken).map((r) => r.version)).toEqual(['0.6']);
      expect(parseReleases('not a list')).toEqual([]);
    });
  });

  // What types cannot check about hand-written data, this does: the file the
  // app actually ships is read here, not a fixture.
  describe('the notes this build ships', () => {
    it('are all readable, so nothing is silently left out', () => {
      expect(RELEASES.length).toBe(notes.releases.length);
    });

    it('say the same number of things in both languages', () => {
      for (const entry of RELEASES) {
        expect(entry.lines.ru.length, `release ${entry.version}`).toBe(
          entry.lines.en.length,
        );
      }
    });

    it('name every release once', () => {
      const versions = RELEASES.map((entry) => entry.version);
      expect(new Set(versions).size).toBe(versions.length);
    });

    it('are dated the day they were cut, wherever the player is', () => {
      // The stored value is a calendar day read as UTC midnight. Formatted
      // in the device's own zone it would slip to the day before for every
      // player west of UTC, which is what the pinned zone prevents — here
      // the same date written in Honolulu's zone is the 12th.
      expect(releaseDate('2026-11-13', 'en')).toBe('November 13, 2026');
      expect(
        new Intl.DateTimeFormat('en', {
          dateStyle: 'long',
          timeZone: 'Pacific/Honolulu',
        }).format(new Date('2026-11-13T00:00:00Z')),
      ).toBe('November 12, 2026');
    });

    it('have nothing waiting that a release has already said', () => {
      // `npm run release` empties this; a line left behind would be shown
      // again in the next release.
      expect(notes.unreleased.en.length).toBe(notes.unreleased.ru.length);
    });
  });
});
