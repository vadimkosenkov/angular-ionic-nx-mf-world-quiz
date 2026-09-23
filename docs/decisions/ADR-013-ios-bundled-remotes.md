# ADR-013: The iPhone app ships the quiz remotes inside its bundle

## Status

Accepted (2026-09-23), Phase 13a (`feat/ios-app`). Refines
[ADR-002](ADR-002-microfrontends.md), which foresaw this ("iOS bundles
remotes locally") without deciding how.

## Context

On the web the shell loads each quiz from its own origin at runtime
(`federation.manifest.json` → `https://capitals…/remoteEntry.json`). That is
the point of the microfrontends: separate builds, separate deployments.

The iPhone app is the same shell inside Capacitor, and three things make
runtime loading from the network wrong there:

- **The app must work offline.** Playing offline and syncing later is a
  product requirement (ADR-006); a quiz that needs a download to start is
  not offline-capable.
- **The App Store does not allow it.** An app may not download and execute
  code that was not reviewed with it. Loading a remote's JavaScript over
  HTTP is exactly that.
- **Latency and failure.** A first quiz would wait for a network round trip,
  and a remote that is briefly unavailable would break the app.

## Decision

The iOS bundle contains the shell **and both remotes**, and the federation
manifest points at them with relative paths:

```
ios-www/
  index.html, main-*.js, …        the shell's production build
  remotes/capitals/remoteEntry.json …
  remotes/flags/remoteEntry.json …
  federation.manifest.json        { "capitals": "remotes/capitals/remoteEntry.json", … }
  config.json                     the API URL for this build
```

`tools/scripts/build-ios-bundle.mjs` assembles it from the ordinary
production builds, and `nx run shell:ios-bundle` runs the builds first;
`nx run shell:ios-sync` then copies it into the Xcode project.

**Nothing in the applications changes.** The shell still calls
`initFederation('federation.manifest.json')` and loads remotes through
`loadQuizRemoteRoutes`; the remotes still expose `./routes`. Only the
manifest's values differ between web and app — which is exactly the
indirection the manifest exists for.

## Alternatives

| Alternative                                           | Why not                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Load the remotes from the web at runtime**          | Breaks offline play, and the App Store forbids executing downloaded code                                      |
| **Import the quiz statically into the shell for iOS** | A second composition of the app to build and test; the federation code path would then be untested on iOS     |
| **Download and cache the remotes on first run**       | Still downloaded code, plus a cache to invalidate; a first run without network would have no quiz             |
| **Capacitor Live Updates (or similar)**               | Same App Store problem for code, and it adds a service; updates go through the App Store like everything else |

## Consequences

- The app's size grows by both remotes. They share Angular, Ionic and the
  dataset through the federation's shared bundles, so the increase is small
  (the remotes' own code is a few kilobytes each).
- A quiz can only change with an App Store release. That is the intended
  trade-off: on iOS the "independent deployment" of a remote buys nothing.
- The web and the app run the **same** federation code, so a mistake in the
  contract shows up in both; the E2E suite keeps testing the web variant,
  where remotes really are fetched across origins.
- `config.json` is part of the bundle, so the app's API URL is fixed per
  build (ADR-012 keeps the same file name and format as the web build).
