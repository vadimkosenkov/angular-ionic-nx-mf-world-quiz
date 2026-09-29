/* eslint-disable no-undef -- a service worker runs outside the app's scope. */
/**
 * What makes the installed app work without a network.
 *
 * Written by hand rather than with Angular's service worker: this app is
 * three deployments on three origins (the shell and the two quiz remotes),
 * and Angular's builder only knows about the files of the one it builds.
 * The rules below are about *kinds* of request, so a remote's files are
 * kept exactly like the shell's.
 *
 * Four rules, in the order requests are judged:
 *
 * 1. **The API is never cached.** A score, a leaderboard or a sign-in has
 *    to be the server's current answer, and stale data here would be worse
 *    than an error. Offline play is not affected: finished quizzes are kept
 *    on the device (IndexedDB) and sent when the network returns.
 * 2. **Pages come from the network first**, falling back to the cached
 *    page. This way a deployment is picked up on the next visit, and an
 *    offline visit still opens the app.
 * 3. **The files a deployment rewrites come from the network first** too
 *    (see `MUTABLE`).
 * 4. **Everything else — scripts, styles, flags, fonts — is served from
 *    the cache first** and fetched in the background if missing. These
 *    files carry a hash in their name, so a new build asks for new names
 *    and the old entries are dropped with the old cache.
 */

// Bumping this name is how an old cache is thrown away: the new worker
// deletes every cache that is not its own.
const CACHE = 'world-quiz-v1';
/** The page that answers a navigation when the network is gone. */
const APP_SHELL = '/index.html';

/**
 * The files whose **name stays the same while their contents change**, so
 * the cache-first rule would freeze a deployment in place:
 *
 * - `config.json` — the API's address and the Google client, written per
 *   environment by `tools/scripts/write-deploy-config.mjs`.
 * - `federation.manifest.json` — where the quiz remotes live.
 * - `remoteEntry.json` — a remote's list of its (hashed) files; a new build
 *   of a remote changes only this file's contents.
 * - `manifest.webmanifest` — the installed app's name, colours and icons.
 *
 * Without this rule an installed app would keep the previous deployment's
 * API and remote addresses until someone cleared the site's data: the
 * start-up fetch asks for `config.json` with `cache: 'no-cache'`, but that
 * only concerns the browser's HTTP cache — a worker answering from Cache
 * Storage is never reached by it.
 */
const MUTABLE = [
  '/config.json',
  '/federation.manifest.json',
  '/remoteEntry.json',
  '/manifest.webmanifest',
];

const isMutable = (url) => MUTABLE.some((name) => url.pathname.endsWith(name));

/** The API: `/v1/...` on this origin (a deployment proxies it) or its own host. */
const isApi = (url) => url.pathname.startsWith('/v1/');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([APP_SHELL, '/manifest.webmanifest']))
      // A missing file must not leave the app without a worker at all.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Keeps a good answer for the next offline visit. */
function remember(key, response) {
  if (!response.ok && response.type !== 'opaque') return;
  const copy = response.clone();
  void caches.open(CACHE).then((cache) => cache.put(key, copy));
}

/**
 * The network decides; the cache only answers when it cannot be reached.
 * `key` is what the answer is stored under — the request itself, or the app
 * shell for a navigation, since every route is served by the same page.
 */
function networkFirst(request, key) {
  return fetch(request)
    .then((response) => {
      remember(key, response);
      return response;
    })
    .catch(() =>
      caches
        .match(key)
        .then(
          (cached) =>
            cached ?? new Response('', { status: 504, statusText: 'Offline' }),
        ),
    );
}

/** For files whose name changes with their contents. */
function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) return cached;
    return fetch(request).then((response) => {
      // Opaque responses (a cross-origin file without CORS) are stored as
      // they are; the quiz remotes send CORS headers, so theirs are not.
      remember(request, response);
      return response;
    });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isApi(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_SHELL));
  } else if (isMutable(url)) {
    event.respondWith(networkFirst(request, request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});
