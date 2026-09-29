import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './service-worker';

/** Just enough of the browser's registry to see whether it was asked. */
function fakeServiceWorker() {
  const registered: string[] = [];
  return {
    registered,
    container: {
      register: (url: string) => {
        registered.push(url);
        return Promise.resolve({} as ServiceWorkerRegistration);
      },
    } as unknown as ServiceWorkerContainer,
  };
}

const atHost = (hostname: string) => ({ hostname }) as Location;

/**
 * jsdom reports the document as already loaded, which is also the common
 * case in the app: it starts after `load`. Firing the event as well covers
 * the other path.
 */
const load = () => window.dispatchEvent(new Event('load'));

describe('registerServiceWorker', () => {
  it('registers the worker on a deployed host', () => {
    const worker = fakeServiceWorker();

    registerServiceWorker(atHost('world-quiz.example'), worker.container);
    load();

    // Once, whether the page had finished loading before or after the call.
    expect(worker.registered).toEqual(['service-worker.js']);
  });

  // A worker that serves yesterday's chunk from its cache while the dev
  // server rebuilds is a very confusing afternoon.
  it('stays out of the way during development', () => {
    const worker = fakeServiceWorker();

    registerServiceWorker(atHost('localhost'), worker.container);
    load();

    expect(worker.registered).toEqual([]);
  });

  it('does nothing in a browser without service workers', () => {
    expect(() =>
      registerServiceWorker(atHost('world-quiz.example'), undefined),
    ).not.toThrow();
  });
});
