import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

/**
 * The rules in `apps/shell/public/service-worker.js`, exercised for real.
 *
 * The worker cannot be imported: it is plain JavaScript that talks to a
 * browser API the app never sees (`caches`, and a `fetch` event with
 * `respondWith`). So the file is read and run against a fake of that API,
 * which is enough to ask the only questions that matter — what comes from
 * the network, what comes from the cache, and what is never cached at all.
 * Getting one of those wrong is invisible until an installed app is stuck
 * on an old deployment.
 */

/** cwd is the workspace root under Nx, the project's folder under Vitest. */
const SOURCE = [
  'apps/shell/public/service-worker.js',
  'public/service-worker.js',
].find(existsSync);

interface FakeResponse {
  readonly ok: boolean;
  readonly type: string;
  readonly body: string;
  clone(): FakeResponse;
}

const answer = (body: string, ok = true): FakeResponse => ({
  ok,
  type: 'basic',
  body,
  clone() {
    return this;
  },
});

type Key = string | { url: string };
const nameOf = (key: Key) => (typeof key === 'string' ? key : key.url);

/** Cache Storage, reduced to what the worker uses. */
function fakeCaches() {
  const stores = new Map<string, Map<string, FakeResponse>>();
  const open = (name: string) => {
    const store = stores.get(name) ?? new Map<string, FakeResponse>();
    stores.set(name, store);
    return Promise.resolve({
      addAll: (keys: string[]) => {
        for (const key of keys) store.set(key, answer(`precached ${key}`));
        return Promise.resolve();
      },
      put: (key: Key, response: FakeResponse) => {
        store.set(nameOf(key), response);
        return Promise.resolve();
      },
      match: (key: Key) => Promise.resolve(store.get(nameOf(key))),
    });
  };
  const matchAll = (key: Key) => {
    for (const store of stores.values()) {
      const found = store.get(nameOf(key));
      if (found) return Promise.resolve(found);
    }
    return Promise.resolve(undefined);
  };
  return {
    stores,
    api: {
      open,
      match: matchAll,
      keys: () => Promise.resolve([...stores.keys()]),
      delete: (name: string) => Promise.resolve(stores.delete(name)),
    },
  };
}

interface Harness {
  /** Sends a request through the worker; `undefined` = the worker let it pass. */
  request(url: string, mode?: string): Promise<FakeResponse | undefined>;
  /** What the worker asked the network for, in order. */
  readonly fetched: string[];
  /** Stores a response as if an earlier visit had cached it. */
  cache(url: string, body: string): Promise<void>;
  /** Makes every further network request fail, as being offline does. */
  goOffline(): void;
}

function runWorker(): Harness {
  if (!SOURCE) throw new Error('service-worker.js was not found');
  const source = readFileSync(SOURCE, 'utf8');

  const listeners = new Map<string, (event: unknown) => void>();
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      listeners.set(type, listener),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  };
  const caches = fakeCaches();
  const fetched: string[] = [];
  let offline = false;
  const fetch = (request: { url: string }) => {
    fetched.push(request.url);
    return offline
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(answer(`network ${request.url}`));
  };
  const Response = class {
    constructor(
      readonly body: string,
      readonly init: { status: number },
    ) {}
    readonly ok = false;
  };

  // The worker is a script, not a module: it is given the globals it uses.
  new Function('self', 'caches', 'fetch', 'Response', source)(
    self,
    caches.api,
    fetch,
    Response,
  );

  return {
    fetched,
    async request(url, mode = 'no-cors') {
      const handler = listeners.get('fetch');
      if (!handler) throw new Error('the worker registered no fetch handler');
      let answered: Promise<FakeResponse> | undefined;
      handler({
        request: { method: 'GET', url, mode },
        respondWith: (response: Promise<FakeResponse>) => (answered = response),
      });
      return answered ? await answered : undefined;
    },
    async cache(url, body) {
      const cache = await caches.api.open('world-quiz-v1');
      await cache.put(url, answer(body));
    },
    goOffline: () => (offline = true),
  };
}

describe('the service worker', () => {
  let worker: Harness;

  beforeEach(() => {
    worker = runWorker();
  });

  // Stale data here would be worse than an error: a score, a leaderboard or
  // a sign-in has to be the server's current answer.
  it('never answers for the API', async () => {
    expect(
      await worker.request('https://app.example/v1/sessions'),
    ).toBeUndefined();
    expect(worker.fetched).toEqual([]);
  });

  it('serves a hashed file from the cache without asking the network', async () => {
    const url = 'https://app.example/main-4XKPQ3T2.js';
    await worker.cache(url, 'the cached script');

    const response = await worker.request(url);

    expect(response?.body).toEqual('the cached script');
    expect(worker.fetched).toEqual([]);
  });

  describe('the files a deployment rewrites', () => {
    const files = [
      'https://app.example/config.json',
      'https://app.example/federation.manifest.json',
      'https://capitals.example/remoteEntry.json',
    ];

    // The bug this prevents: an installed app keeping the previous
    // deployment's API address and remote URLs for as long as it is
    // installed, because their names never change.
    it.each(files)(
      'asks the network for %s even when it is cached',
      async (url) => {
        await worker.cache(url, 'the previous deployment');

        const response = await worker.request(url);

        expect(worker.fetched).toEqual([url]);
        expect(response?.body).toEqual(`network ${url}`);
      },
    );

    it.each(files)('falls back to the cached %s when offline', async (url) => {
      await worker.cache(url, 'the previous deployment');
      worker.goOffline();

      expect((await worker.request(url))?.body).toEqual(
        'the previous deployment',
      );
    });
  });

  describe('a page', () => {
    const page = 'https://app.example/home';

    it('comes from the network, so a deployment is picked up', async () => {
      const response = await worker.request(page, 'navigate');

      expect(worker.fetched).toEqual([page]);
      expect(response?.body).toEqual(`network ${page}`);
    });

    // Every route is drawn by the same page, so the cached shell answers for
    // a route that was never visited before.
    it('comes from the cached shell when offline', async () => {
      await worker.cache('/index.html', 'the app shell');
      worker.goOffline();

      const response = await worker.request(
        'https://app.example/achievements',
        'navigate',
      );

      expect(response?.body).toEqual('the app shell');
    });

    it('is a plain failure when nothing is cached either', async () => {
      worker.goOffline();

      const response = await worker.request(page, 'navigate');

      expect(response?.ok).toBe(false);
    });
  });
});
