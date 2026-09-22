# Troubleshooting

Real problems hit while building this repository, with causes and fixes.

## `npm warn EBADENGINE ... required: { node: '^22.22.3 || ^24.15.0 || >=26.0.0' }`

**Cause:** Angular 22 packages declare a minimum Node patch version. Node
24.14 and older 24.x releases are below it.

**Fix:** `nvm install && nvm use` (reads `.nvmrc`). Installs and builds still
work on older 24.x, but only the declared range is supported.

## `The externalDependency 'eslint' for '<project>:lint' could not be found`

**Cause:** Nx could not read `package-lock.json`, so its graph has no npm
packages. In this repo the original `.gitignore` ignored the lockfile, and Nx
respects `.gitignore`.

**Fix:** keep `package-lock.json` tracked (it is), then `npx nx reset`.

## `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`

**Cause:** TypeScript 6 deprecates `baseUrl`. Older Nx/Angular templates still add it.

**Fix:** remove `baseUrl`; `paths` resolve relative to the tsconfig that
declares them. Do not silence it with `ignoreDeprecations`.

## `TS4111: Property 'PORT' comes from an index signature`

**Cause:** `noPropertyAccessFromIndexSignature` is enabled in
`tsconfig.base.json`. It forces `process.env['PORT']` so a typo cannot pass silently.

**Fix:** use bracket access, or better, read configuration through the validated `loadConfig()`.

## `cypress.config.ts could not be loaded under Node's native TypeScript stripping (__filename is not defined in ES module scope)`

**Cause:** Nx evaluates the Cypress config with Node's built-in TypeScript
stripping. ES `import` syntax makes Node treat the file as an ES module, where `__filename` does not exist.

**Fix:** keep `apps/shell-e2e/cypress.config.ts` in CommonJS (`require` / `module.exports`), as generated.

## `npm install` fails in esbuild's postinstall with `Unknown system error -88`

**Cause:** esbuild's install script runs its freshly downloaded native binary
to verify it. A partially written binary (interrupted or concurrent install)
cannot be executed.

**Fix:** run `npm install` again; `node_modules/esbuild/bin/esbuild --version` should print a version.

## `'@world-quiz/shared/util' import is restricted … must not depend on Node.js built-ins`

**Cause:** ESLint `no-restricted-imports` **patterns** use gitignore
semantics, so a pattern `util` matches any path segment named `util`,
including the workspace library `@world-quiz/shared/util`.

**Fix:** list bare module names under `paths` (exact match) and keep only
`node:*` under `patterns`. This is how `eslint.config.mjs` does it.

## `npm warn install-scripts … packages have install scripts not yet covered by allowScripts`

**Cause:** npm 11.19+ (shipped with Node 24.21) reports dependencies with
install scripts (esbuild, Cypress, Nx, lmdb, …) that are not explicitly allowed.
Today this is a warning and the scripts still run.

**Fix:** none needed yet. Reviewing and allowing the required scripts
explicitly is tracked as a follow-up, because future npm versions may block
unapproved scripts by default.

## Git shows a source file as binary (`git diff --numstat` prints `-  -`)

**Cause:** the file contains a raw control character, for example a NUL byte
inside a string literal. Git then treats the whole file as binary, and diffs
disappear from code review. In Phase 2 this happened in `leaderboard.ts`: a
`\u0000` escape was turned into the real byte by the tool that wrote the file.

**Fix:** write escape sequences, or avoid special separators altogether (the
leaderboard now builds composite keys with `JSON.stringify`). CI runs
`npm run check:control-chars`, which fails with the file and line of any such character.

## `ERESOLVE … @analogjs/vite-plugin-angular … Conflicting peer dependency: @angular/compiler-cli`

**Cause:** `nx g @nx/angular:library --unitTestRunner=vitest-analog` adds
AnalogJS. Its _optional_ peer dependency on `@angular-devkit/build-angular`
makes npm evaluate an Angular 21 version against Angular 22 and fail.

**Fix used here:** do not use AnalogJS. Angular libraries use Angular's own
`@angular/build:unit-test` builder with `buildTarget: shell:esbuild:development`
(see docs/architecture/nx.md). The workspace default for new Angular
libraries is `unitTestRunner: none`; add the test target by hand.

## `window.matchMedia is not a function` / `scrollTo is not a function` in component tests

**Cause:** jsdom does not implement these browser APIs; Ionic and the settings library use them.

**Fix:** test targets that render components load
`tools/testing/jsdom-setup.ts` (`setupFiles` in the project's `test` target),
which provides minimal implementations.

## Nx shows stale results or odd graph errors

```bash
npx nx reset
```

This clears the local cache, workspace data and daemon.

## `/quiz/capitals` or `/quiz/flags` shows "Quiz unavailable"

**Cause:** that microfrontend is not being served. The shell fetches
`http://localhost:4201/remoteEntry.json` (Capitals) and
`http://localhost:4202/remoteEntry.json` (Flags), listed in
`apps/shell/public/federation.manifest.json`, at start-up; the browser console
shows the failed request.

**Fix:** start all three applications with `npm run start:quiz`. The fallback page
itself is intended behaviour, not a bug — see
[microfrontends.md](../architecture/microfrontends.md).

## The remote loads, but injection fails inside it (`NullInjectorError`)

**Cause:** a token exists twice because its library was not shared. Native
Federation shares workspace libraries through the `tsconfig` path mappings, so
a library that is missing from `shared` in `remoteEntry.json` is bundled
separately into both applications — and two `InjectionToken` instances never
match.

**Fix:** make sure the library has a path mapping in `tsconfig.base.json` and
appears in the `shared` list of both `remoteEntry.json` files after a build.

## Cypress cannot click an element that is "covered by another element"

**Cause:** Ionic's translucent header. Cypress scrolls the target to the top
of the scroll container, which is exactly where the toolbar sits.

**Fix:** click with `{ scrollBehavior: 'center' }` instead of forcing the
click, so the test still proves the element is really clickable.

## Dev server: the UI renders in Times and Ionic looks unstyled

**Cause:** Ionic's global stylesheets were not loaded. They used to be pulled
in from `styles.scss` with `@import '@ionic/angular/css/core.css'`. The Native
Federation dev server leaves such a package `@import` untouched in the served
CSS, and the browser cannot resolve it; the production build inlined it, so
tests and E2E did not notice. `@use '@ionic/angular/css/core'` (without the
extension) fails too, because the package only exports the exact
`css/*.css` paths.

**Fix used here:** Ionic's CSS files are listed directly in the `styles`
array of each app's `project.json`, followed by the design system
(`libs/client/ui/src/styles/index.scss`).

## Starting a quiz shows the results of the previous one

**Cause:** Ionic's `ion-router-outlet` keeps a stack of page instances and
reuses an existing page when the same URL is opened again. Leaving the quiz
with a plain `router.navigate(['/home'])` could leave the finished quiz page
in that stack; starting a quiz with the same options (the same URL) then
brought the old page, with its results, back.

**Fix used here:** leaving the quiz calls `NavController.navigateRoot('/home')`,
which replaces the whole stack, and `QuizPage` resets itself in
`ionViewDidLeave`, so a cached page brought back by Ionic starts a new quiz.
(`ionViewWillEnter` would be the wrong hook: it also fires when an iOS
swipe-back is started and cancelled, which would restart a quiz in progress.)
Covered by a unit
test and by the Flags E2E journey.

## "Google sign-in is unavailable" / `403 Forbidden` from `accounts.google.com/gsi/*`

**Symptom:** the Google button does not load on the welcome screen;
`gsi/client` or `gsi/button` answers 403, while an incognito window, or the
same window without device emulation, gets 200.

**Cause:** Chrome DevTools' device presets (e.g. "iPhone 17") replace the
User-Agent with Safari on iOS, but the other signals (`Sec-CH-UA` client
hints, FedCM support) still say desktop Chrome on macOS. Google's protection
against stolen sessions appears to refuse the browser's Google cookies from
such an inconsistent "device". The width is irrelevant: the same requests
without cookies succeed for any width and User-Agent.

**Fix:** for a phone-sized layout with Google sign-in, use DevTools'
**Responsive** mode with a phone width (e.g. 400) instead of a device preset,
or an incognito window. Real phones are not affected; the iOS app uses the
native Google SDK (Phase 13).

## The Google button shows another language, or "Sign in as …"

**Cause:** the button is Google's iframe. The app passes its language
(`hl`), but Google may prefer the language of the Google account signed in
to the browser; once an account has signed in to the app, Google shows a
personalised button. Neither can be switched off from the app (see the TODO
in `libs/client/auth/src/lib/google-sign-in-button.ts`).

**Fix:** none needed; an incognito window shows the plain button in the app's
language.
