#!/usr/bin/env node
/**
 * Assembles what the iOS app ships: the shell plus **both quiz remotes**, in
 * one folder (`dist/apps/shell/ios-www`).
 *
 * On the web a remote is fetched from its own origin at runtime. An iPhone
 * app cannot do that: it must work offline, and the App Store does not allow
 * an app to load code it did not ship. So the same builds are copied into
 * the bundle and the federation manifest points at them with **relative**
 * paths — the federation contract stays exactly the same, only the manifest
 * differs (ADR-002, ADR-013).
 *
 *   node tools/scripts/build-ios-bundle.mjs
 *
 * Environment (all optional), written into the app's `config.json`:
 * - `API_URL` — the API this build talks to. The simulator can reach a
 *   `localhost` API, a real device cannot (docs/deployment/ios.md).
 * - `GOOGLE_IOS_CLIENT_ID` — the iOS OAuth client for the native sign-in;
 *   without it the app has no way to sign in and says so.
 * - `DEV_SIGN_IN=true` — offer the API's development sign-in in this build.
 *   For development only, against an API that enables it.
 */
import { cp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const REMOTES = ['capitals', 'flags'];
const SOURCE = (app) => join('dist', 'apps', app, 'browser');
const TARGET = join('dist', 'apps', 'shell', 'ios-www');

const built = async (app) => {
  await access(join(SOURCE(app), 'index.html')).catch(() => {
    throw new Error(
      `${app} is not built. Run: npx nx run-many -t build -p shell capitals flags`,
    );
  });
};

async function main() {
  for (const app of ['shell', ...REMOTES]) await built(app);

  await rm(TARGET, { recursive: true, force: true });
  await cp(SOURCE('shell'), TARGET, { recursive: true });

  for (const remote of REMOTES) {
    await mkdir(join(TARGET, 'remotes'), { recursive: true });
    await cp(SOURCE(remote), join(TARGET, 'remotes', remote), {
      recursive: true,
    });
  }

  // Absolute paths inside the bundle (which is served from the root, both by
  // Capacitor and by a static server). A path without the leading slash
  // makes Native Federation build import-map entries like
  // `remotes/capitals/chunk-X.js`, which an import map cannot resolve — the
  // browser then reports "does not resolve" and the quiz never loads.
  const manifest = Object.fromEntries(
    REMOTES.map((remote) => [remote, `/remotes/${remote}/remoteEntry.json`]),
  );
  await writeFile(
    join(TARGET, 'federation.manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const config = {
    apiUrl: (process.env['API_URL'] ?? 'http://localhost:3333').replace(
      /\/$/,
      '',
    ),
    // Google's web sign-in cannot run in a web view, so the app never has a
    // web client; it signs in through the system with the iOS client.
    googleClientId: null,
    googleIosClientId: process.env['GOOGLE_IOS_CLIENT_ID'] ?? null,
    devSignIn: process.env['DEV_SIGN_IN'] === 'true',
  };
  await writeFile(
    join(TARGET, 'config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
  );

  const signIn = config.googleIosClientId
    ? 'Google (native)'
    : config.devSignIn
      ? 'development sign-in only'
      : 'no sign-in configured';
  console.log(
    `iOS bundle ready in ${TARGET} (API: ${config.apiUrl}, sign-in: ${signIn})`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
