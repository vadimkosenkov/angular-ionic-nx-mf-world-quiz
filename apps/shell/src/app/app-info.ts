/**
 * What this copy of the app is: the version it calls itself, and the build
 * it actually is.
 *
 * Neither is written down in the source. `tools/scripts/stamp-build.mjs`
 * replaces two placeholders in `index.html` when a build is published:
 * `wq-version` with `major.minor.<commits>` (the series from
 * `package.json`, and a patch number that counts itself), and `wq-build`
 * with the commit and the time (`-dirty` when the tree was not clean). So
 * every deployment carries a version of its own without anyone remembering
 * to raise one, and a player reporting something can read both from
 * Settings.
 *
 * A build nobody stamped - a development server, the iPhone bundle - keeps
 * the placeholder, and then there is no version to name: the app says so
 * rather than inventing a number (docs/deployment/ci-cd.md).
 */

/** The placeholder an unstamped build still carries. */
export const UNSTAMPED = 'development';

/** What a build that was never stamped calls itself in Settings. */
export const DEV_VERSION = 'dev';

const meta = (name: string, doc: Document | null): string | null => {
  const content = doc
    ?.querySelector(`meta[name="${name}"]`)
    ?.getAttribute('content')
    ?.trim();
  return !content || content === UNSTAMPED ? null : content;
};

const currentDocument = (): Document | null => globalThis.document ?? null;

/** The version this build was stamped with, or `dev` where there is none. */
export function appVersion(doc: Document | null = currentDocument()): string {
  return meta('wq-version', doc) ?? DEV_VERSION;
}

/**
 * The commit and time this build was stamped with, or `null` where there is
 * none to show.
 */
export function appBuild(
  doc: Document | null = currentDocument(),
): string | null {
  return meta('wq-build', doc);
}
