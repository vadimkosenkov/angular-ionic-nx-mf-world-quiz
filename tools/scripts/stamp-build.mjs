#!/usr/bin/env node
/**
 * Stamps a finished build with the commit it was built from, and with the
 * version that commit makes.
 *
 * Every application's `index.html` carries a placeholder:
 *
 *     <meta name="wq-build" content="development" />
 *
 * and this script replaces its content in the built copy, so that a single
 * request says which code a deployment is actually serving:
 *
 *     curl -s https://… | grep wq-build
 *     <meta name="wq-build" content="a1b2c3d 2026-10-30T14:40Z">
 *
 * The shell's page carries a second placeholder, `wq-version`, which is
 * what Settings shows the player. It is **derived**, never written down:
 * `major.minor` from `package.json` and, as the patch number, how many
 * commits the branch has. So every deployment has a version of its own
 * without anyone remembering to raise one, two deployments can be compared
 * by a number that only ever grows, and nothing has to be committed to cut
 * a release (a build from a dirty tree would otherwise be stamped as the
 * version it is not).
 *
 * Why it is needed: the app is published by hand (`npm run deploy:web`) and
 * its files are hashed, so nothing on the page says how old it is. Three
 * separate deployments (the shell and the two quiz remotes) can also drift
 * apart, and each one answers this question for itself.
 *
 *     node tools/scripts/stamp-build.mjs dist/apps/shell/browser [more…]
 *
 * The commit comes from `GITHUB_SHA` in CI and from git otherwise; a build
 * made with uncommitted changes is marked `-dirty`, because a hand-made
 * deployment is exactly where that happens.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** The meta tags that are stamped, however they are spelled. */
const PLACEHOLDER = /(<meta\s+name="wq-build"\s+content=")[^"]*(")/;
const VERSION_PLACEHOLDER = /(<meta\s+name="wq-version"\s+content=")[^"]*(")/;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** The commit, short, with a marker when the tree was not clean. */
export function buildCommit(env = process.env) {
  if (env['GITHUB_SHA']) return env['GITHUB_SHA'].slice(0, 7);
  try {
    const commit = git('rev-parse', '--short', 'HEAD');
    return git('status', '--porcelain') === '' ? commit : `${commit}-dirty`;
  } catch {
    // A tarball of the sources is not a repository, and that is not a
    // reason to fail a build.
    return 'unknown';
  }
}

/** Minutes are enough to tell two deployments apart, and stay readable. */
export const buildTime = (now = new Date()) =>
  `${now.toISOString().slice(0, 16)}Z`;

export const buildIdentity = (env = process.env, now = new Date()) =>
  `${buildCommit(env)} ${buildTime(now)}`;

/** How many commits this branch has; the patch number of the version. */
export function commitCount() {
  try {
    return Number(git('rev-list', '--count', 'HEAD'));
  } catch {
    return 0;
  }
}

/**
 * `major.minor.<commits>`: the series we chose in `package.json`, and a
 * patch number that counts itself. `npm version minor` starts a new series;
 * nothing else ever needs editing.
 */
export function appVersion(series = packageVersion(), commits = commitCount()) {
  const [major = '0', minor = '0'] = series.split('.');
  return `${major}.${minor}.${commits}`;
}

/** The version `package.json` declares; `0.0` when it cannot be read. */
export function packageVersion() {
  try {
    const path = new URL('../../package.json', import.meta.url);
    return JSON.parse(readFileSync(path, 'utf8')).version ?? '0.0';
  } catch {
    return '0.0';
  }
}

/**
 * Returns the page with the placeholders replaced. Throws when there is no
 * build placeholder: a build that silently went out unstamped is the thing
 * this script exists to prevent. The version placeholder is optional —
 * only the page a player opens carries one.
 */
export function stampHtml(html, identity, version = appVersion()) {
  if (!PLACEHOLDER.test(html)) {
    throw new Error('No <meta name="wq-build"> to stamp');
  }
  return html
    .replace(PLACEHOLDER, `$1${identity}$2`)
    .replace(VERSION_PLACEHOLDER, `$1${version}$2`);
}

async function main() {
  const directories = process.argv.slice(2);
  if (directories.length === 0) {
    console.error('Usage: stamp-build.mjs <build output directory>…');
    process.exit(1);
  }

  const identity = buildIdentity();
  const version = appVersion();
  for (const directory of directories) {
    const page = join(directory, 'index.html');
    const html = await readFile(page, 'utf8').catch(() => {
      throw new Error(`Not a built application: ${directory}`);
    });
    await writeFile(page, stampHtml(html, identity, version));
    console.log(`Stamped ${page} with ${version} (${identity})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
