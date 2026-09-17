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
`@angular/build:unit-test` builder with `buildTarget: shell:build:development`
(see docs/architecture/nx.md). The workspace default for new Angular
libraries is `unitTestRunner: none`; add the test target by hand.

## `window.matchMedia is not a function` / `scrollTo is not a function` in component tests

**Cause:** jsdom does not implement these browser APIs; Ionic and the settings library use them.

**Fix:** the shell's test target loads `apps/shell/src/testing/test-setup.ts`,
which provides minimal implementations. Library tests that render such
components need the same setup.

## Nx shows stale results or odd graph errors

```bash
npx nx reset
```

This clears the local cache, workspace data and daemon.
