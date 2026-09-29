/**
 * Registers the service worker that makes the installed app work offline
 * (`apps/shell/public/service-worker.js`).
 *
 * Not during development: the dev server rebuilds files on every change,
 * and a worker serving yesterday's chunk from its cache is a confusing way
 * to spend an afternoon. `localhost` is therefore left alone — and the
 * production build can still be checked with `nx run shell:serve-static`,
 * which serves on `127.0.0.1`.
 */
export function registerServiceWorker(
  location: Location = window.location,
  serviceWorker: ServiceWorkerContainer | undefined = navigator.serviceWorker,
): void {
  if (!serviceWorker || location.hostname === 'localhost') return;

  const register = () =>
    void serviceWorker
      .register('service-worker.js')
      .catch((error: unknown) =>
        console.error('[shell] the service worker was not registered', error),
      );

  // After the page has loaded: registering competes with starting the app,
  // and the worker only matters from the next visit on. The application
  // itself often starts *after* `load` has already fired (its modules are
  // fetched through the federation's import map), and waiting for an event
  // that has been and gone would mean never registering at all.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
