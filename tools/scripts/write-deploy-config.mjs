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
 * Optional: GOOGLE_CLIENT_ID (empty disables Google sign-in),
 * API_UPSTREAM (see below).
 *
 * **The sign-in cookie decides the shape of this.** The API sets an
 * httpOnly `SameSite=Strict` cookie, which a browser only sends back when
 * the app and the API are the same site. With the app on one host and the
 * API on another, the cookie never comes back and a reload signs the player
 * out. So a deployment either puts both under one domain, or — as the free
 * hosting here does — serves the API under the app's own origin:
 * `API_URL=/` plus `API_UPSTREAM=https://…` writes a Netlify `_redirects`
 * rule that proxies `/v1/*` to the real API.
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

  // `API_URL=/` means "under this app's own origin"; the app then asks for
  // `/v1/…` and the proxy below carries it to the API.
  const apiUrl = withoutTrailingSlash(env['API_URL']);
  const upstream = env['API_UPSTREAM']
    ? withoutTrailingSlash(env['API_UPSTREAM'])
    : '';
  if (apiUrl === '' && !upstream) {
    throw new Error('API_URL=/ needs API_UPSTREAM: the address to proxy to');
  }

  const files = {
    'config.json': {
      apiUrl,
      googleClientId: env['GOOGLE_CLIENT_ID'] || null,
    },
    'federation.manifest.json': {
      capitals: remoteEntry(env['CAPITALS_URL']),
      flags: remoteEntry(env['FLAGS_URL']),
    },
  };

  // Netlify reads `_redirects` from the published folder, top to bottom.
  // The proxy (`200` = proxy, not redirect) has to come first; the last rule
  // is the one every single-page app needs — the routes are drawn by the
  // app, so a reload of `/home` must still be served `index.html` instead of
  // a 404.
  const rules = [];
  if (upstream) rules.push(`/v1/*  ${upstream}/v1/:splat  200`);
  rules.push('/*  /index.html  200');
  files['_redirects'] = `${rules.join('\n')}\n`;
  return files;
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
    const body =
      typeof content === 'string'
        ? content
        : `${JSON.stringify(content, null, 2)}\n`;
    await writeFile(path, body);
    console.log(`Wrote ${path}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
