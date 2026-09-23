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
 * Environment (optional): API_URL, GOOGLE_CLIENT_ID for the app's
 * `config.json`. The defaults are the development ones; the simulator can
 * reach a `localhost` API, a real device cannot (docs/deployment/ios.md).
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
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? null,
  };
  await writeFile(
    join(TARGET, 'config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
  );

  console.log(`iOS bundle ready in ${TARGET} (API: ${config.apiUrl})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
