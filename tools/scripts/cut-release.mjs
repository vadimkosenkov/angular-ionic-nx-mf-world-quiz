#!/usr/bin/env node
/**
 * Cuts a release: the lines waiting in `unreleased` become a dated entry
 * the app shows, and `package.json` moves to the version they were filed
 * under.
 *
 * ```
 * npm run release              # 0.4 → 0.5, the waiting lines become 0.5
 * npm run release -- --amend   # add them to the newest entry instead
 * ```
 *
 * A deploy is a release (docs/deployment/releasing.md), so the default is a
 * new series. `--amend` is for the case where a release was cut but not
 * deployed yet and more work landed on top of it: it is explicit, because
 * nothing in the repository can tell whether the last entry went out.
 *
 * It deliberately commits nothing. The deploy stamps the bundle with the
 * commit it is built from, and a tree with uncommitted changes would be
 * stamped `-dirty` — so the cut is reviewed and committed by hand, and the
 * deploy runs from a clean tree.
 */
import {
  NOTES_FILE,
  PACKAGE_FILE,
  nextSeries,
  readNotes,
  series,
  today,
  unreleasedLines,
  writeNotes,
} from './release-notes.mjs';
import { readFile, writeFile } from 'node:fs/promises';

async function main() {
  const amend = process.argv.includes('--amend');
  const notes = await readNotes();
  const { en, ru, count } = unreleasedLines(notes);

  if (count === 0) {
    throw new Error(
      `Nothing to release: ${NOTES_FILE} has no unreleased lines.\n` +
        'A change the player can see is written down in the PR that makes it.',
    );
  }
  if (en.length !== ru.length) {
    throw new Error(
      `The unreleased lines do not match: ${en.length} in English, ${ru.length} in Russian.\n` +
        'A release with one language short would show English to everyone.',
    );
  }

  const packageJson = JSON.parse(await readFile(PACKAGE_FILE, 'utf8'));
  const releases = notes.releases ?? [];
  const newest = releases[0];

  if (amend && !newest) {
    throw new Error('Nothing to amend: there is no release yet.');
  }

  if (amend) {
    newest.lines.en = [...newest.lines.en, ...en];
    newest.lines.ru = [...newest.lines.ru, ...ru];
    newest.date = today();
  } else {
    const version = nextSeries(packageJson.version);
    if (releases.some((release) => release.version === version)) {
      throw new Error(
        `Release ${version} is already written down. Use --amend to add to it.`,
      );
    }
    releases.unshift({ version, date: today(), lines: { en, ru } });
    packageJson.version = `${version}.0`;
    await writeFile(PACKAGE_FILE, `${JSON.stringify(packageJson, null, 2)}\n`);
  }

  notes.unreleased = { en: [], ru: [] };
  notes.releases = releases;
  await writeNotes(notes);

  const version = series(packageJson.version);
  console.log(
    `Release ${version} (${releases[0].date}): ${count} line(s) in two languages.`,
  );
  console.log(`  ${NOTES_FILE}`);
  if (!amend) console.log(`  ${PACKAGE_FILE} → ${packageJson.version}`);
  console.log('\nReview it, commit it, then deploy: npm run deploy:web');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
