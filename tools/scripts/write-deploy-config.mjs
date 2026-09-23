#!/usr/bin/env node
/**
 * Writes the shell's per-environment configuration into a finished build.
 *
 * The shell is built once and deployed to every environment: it reads
 * `config.json` (the API and the Google client) and
 * `federation.manifest.json` (where the quiz remotes live) at start-up, and
 * a deployment replaces those two files. See
 * docs/deployment/deploying.md.
 *
 *   node tools/scripts/write-deploy-config.mjs dist/apps/shell/browser
 *
 * Required environment variables: API_URL, CAPITALS_URL, FLAGS_URL.
 * Optional: GOOGLE_CLIENT_ID (empty disables Google sign-in).
 */
import { writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const REQUIRED = ['API_URL', 'CAPITALS_URL', 'FLAGS_URL'];

/** `https://example.test/` and `https://example.test` mean the same origin. */
const withoutTrailingSlash = (url) => url.replace(/\/$/, '');

/** A remote is addressed by its `remoteEntry.json`. */
const remoteEntry = (url) => `${withoutTrailingSlash(url)}/remoteEntry.json`;

export function deployConfig(env) {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
  return {
    'config.json': {
      apiUrl: withoutTrailingSlash(env['API_URL']),
      googleClientId: env['GOOGLE_CLIENT_ID'] || null,
    },
    'federation.manifest.json': {
      capitals: remoteEntry(env['CAPITALS_URL']),
      flags: remoteEntry(env['FLAGS_URL']),
    },
  };
}

async function main() {
  const directory = process.argv[2];
  if (!directory) {
    console.error('Usage: write-deploy-config.mjs <build output directory>');
    process.exit(1);
  }
  await access(join(directory, 'index.html')).catch(() => {
    console.error(`Not a built application: ${directory}`);
    process.exit(1);
  });

  const files = deployConfig(process.env);
  for (const [name, content] of Object.entries(files)) {
    const path = join(directory, name);
    await writeFile(path, `${JSON.stringify(content, null, 2)}\n`);
    console.log(`Wrote ${path}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
