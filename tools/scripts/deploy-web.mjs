#!/usr/bin/env node
/**
 * Publishes the built web app to Netlify: the shell and both quiz remotes,
 * each to its own site.
 *
 * ```
 * npm run deploy:web            # build, configure, publish all three
 * npm run deploy:web -- --skip-build
 * ```
 *
 * The addresses below are the project's own deployment and are public
 * values; every one of them can be overridden from the environment, which
 * is how a second environment (or someone else's fork) would use this.
 * Nothing secret lives here: the Netlify credentials come from the CLI's
 * own login (`npx netlify-cli login`) or `NETLIFY_AUTH_TOKEN`.
 *
 * Why not `netlify deploy` three times by hand: the commands need the right
 * `--filter` (this is a monorepo, and without it the CLI stops to ask),
 * the site ids, and the configuration files written into the shell's bundle
 * first. Forgetting the last one publishes an app pointing at localhost.
 */
import { execFileSync } from 'node:child_process';
import { deployConfig } from './write-deploy-config.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const NETLIFY = 'netlify-cli@23';

const environment = {
  // `/` means the app calls its own origin; Netlify proxies /v1 to the API.
  API_URL: process.env['API_URL'] ?? '/',
  API_UPSTREAM:
    process.env['API_UPSTREAM'] ??
    'https://world-quiz-api-staging.onrender.com',
  GOOGLE_CLIENT_ID:
    process.env['GOOGLE_CLIENT_ID'] ??
    '294520908592-vhhkau8mlstl3s1d105i3efqnopuu0nm.apps.googleusercontent.com',
  CAPITALS_URL:
    process.env['CAPITALS_URL'] ?? 'https://world-quiz-capitals.netlify.app',
  FLAGS_URL: process.env['FLAGS_URL'] ?? 'https://world-quiz-flags.netlify.app',
};

const SITES = {
  shell:
    process.env['NETLIFY_SHELL_SITE_ID'] ??
    'de1331ba-6bb8-48bf-90c9-922845aeda38',
  capitals:
    process.env['NETLIFY_CAPITALS_SITE_ID'] ??
    'c4d5487d-449b-46d0-bf72-2f39eae2c655',
  flags:
    process.env['NETLIFY_FLAGS_SITE_ID'] ??
    '49839d0f-c9bd-4a1c-9eb7-531d5e8c9072',
};

const run = (command, args) =>
  execFileSync(command, args, { stdio: 'inherit' });

async function main() {
  const skipBuild = process.argv.includes('--skip-build');

  if (!skipBuild) {
    run('npx', [
      'nx',
      'run-many',
      '-t',
      'build',
      '-p',
      'shell',
      'capitals',
      'flags',
      '--configuration=production',
    ]);
  }

  // The per-environment files: config.json, federation.manifest.json and
  // Netlify's _redirects (the API proxy and the single-page fallback).
  const directory = join('dist', 'apps', 'shell', 'browser');
  for (const [name, content] of Object.entries(deployConfig(environment))) {
    const body =
      typeof content === 'string'
        ? content
        : `${JSON.stringify(content, null, 2)}\n`;
    await writeFile(join(directory, name), body);
  }
  console.log(`Configured ${directory} for ${environment.API_UPSTREAM}`);

  for (const [app, site] of Object.entries(SITES)) {
    console.log(`\nPublishing ${app}…`);
    run('npx', [
      NETLIFY,
      'deploy',
      '--prod',
      '--no-build',
      // Answers "which project in this monorepo?", which otherwise blocks.
      '--filter',
      app,
      '--dir',
      join('dist', 'apps', app, 'browser'),
      '--site',
      site,
    ]);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
