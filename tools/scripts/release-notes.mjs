/**
 * Reading and cutting the release notes the app ships with
 * (`apps/shell/src/app/release-notes/releases.json`).
 *
 * The data is JSON precisely so that this can be a few lines of
 * `JSON.parse` instead of a regex over a TypeScript literal.
 */
import { readFile, writeFile } from 'node:fs/promises';

export const NOTES_FILE = 'apps/shell/src/app/release-notes/releases.json';
export const PACKAGE_FILE = 'package.json';

export async function readNotes(file = NOTES_FILE) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeNotes(notes, file = NOTES_FILE) {
  await writeFile(file, `${JSON.stringify(notes, null, 2)}\n`);
}

/** How many lines are waiting for a release, and whether they match up. */
export function unreleasedLines(notes) {
  const en = notes.unreleased?.en ?? [];
  const ru = notes.unreleased?.ru ?? [];
  return { en, ru, count: Math.max(en.length, ru.length) };
}

/** `major.minor` of the series the app calls itself (app-info.ts). */
export function series(version) {
  const [major, minor] = String(version).split('.');
  return `${major}.${minor}`;
}

/** The next series: a deploy is a release, so the minor moves by one. */
export function nextSeries(version) {
  const [major, minor] = String(version).split('.').map(Number);
  return `${major}.${minor + 1}`;
}

/** Today, as the notes write a date. */
export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
