#!/usr/bin/env node
/**
 * Stamps a finished build with the commit it was built from.
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
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/** The meta tag the build is stamped into, however it is spelled. */
const PLACEHOLDER = /(<meta\s+name="wq-build"\s+content=")[^"]*(")/;

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

/**
 * Returns the page with the placeholder replaced. Throws when there is
 * none: a build that silently went out unstamped is the thing this script
 * exists to prevent.
 */
export function stampHtml(html, identity) {
  if (!PLACEHOLDER.test(html)) {
    throw new Error('No <meta name="wq-build"> to stamp');
  }
  return html.replace(PLACEHOLDER, `$1${identity}$2`);
}

async function main() {
  const directories = process.argv.slice(2);
  if (directories.length === 0) {
    console.error('Usage: stamp-build.mjs <build output directory>…');
    process.exit(1);
  }

  const identity = buildIdentity();
  for (const directory of directories) {
    const page = join(directory, 'index.html');
    const html = await readFile(page, 'utf8').catch(() => {
      throw new Error(`Not a built application: ${directory}`);
    });
    await writeFile(page, stampHtml(html, identity));
    console.log(`Stamped ${page} with ${identity}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
