#!/usr/bin/env node
/**
 * Says which commit each published part of the web app is serving.
 *
 * ```
 * npm run deploy:check
 * ```
 *
 * The app is three deployments — the shell and the two quiz remotes — and
 * they are published one after another, so a run that stops halfway leaves
 * the player with a new shell and an old quiz. Each page carries the commit
 * it was built from (`tools/scripts/stamp-build.mjs`); this reads the three
 * and says plainly whether they agree.
 *
 * Every address can be overridden from the environment, like the deploy
 * script's.
 */
const SITES = {
  shell: process.env['APP_URL'] ?? 'https://world-quiz-shell.netlify.app',
  capitals:
    process.env['CAPITALS_URL'] ?? 'https://world-quiz-capitals.netlify.app',
  flags: process.env['FLAGS_URL'] ?? 'https://world-quiz-flags.netlify.app',
};

const STAMP = /<meta\s+name="wq-build"\s+content="([^"]*)"/;

/** The stamp of one deployment, or why it could not be read. */
async function stampOf(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return { error: `HTTP ${response.status}` };
    const found = STAMP.exec(await response.text());
    // No meta at all means the bundle predates the stamp, which can only
    // be a deployment nobody has replaced since.
    return found
      ? { stamp: found[1] }
      : { error: 'no stamp — never published since the stamp was added' };
  } catch (error) {
    return { error: error.message };
  }
}

async function main() {
  const results = await Promise.all(
    Object.entries(SITES).map(async ([app, url]) => [app, await stampOf(url)]),
  );

  for (const [app, result] of results) {
    console.log(`${app.padEnd(9)} ${result.stamp ?? `✗ ${result.error}`}`);
  }

  const commits = new Set(
    results.map(([, result]) => result.stamp?.split(' ')[0] ?? null),
  );
  console.log(
    commits.size === 1 && !commits.has(null)
      ? '\nAll three serve the same commit.'
      : '\nThe three do not agree: run `npm run deploy:web` to publish them all.',
  );
}

main();
