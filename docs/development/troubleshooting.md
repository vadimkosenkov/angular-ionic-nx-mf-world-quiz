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

## Nx shows stale results or odd graph errors

```bash
npx nx reset
```

This clears the local cache, workspace data and daemon.
