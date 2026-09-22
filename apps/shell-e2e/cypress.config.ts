// CommonJS on purpose: Nx evaluates this file with Node's native TypeScript
// stripping, where ES module syntax would make `__filename` unavailable.
const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
const { defineConfig } = require('cypress');

const preset = nxE2EPreset(__filename, {
  cypressDir: 'src',
  // The shell alone is not enough: each quiz is served by its own
  // application (Capitals on :4201, Flags on :4202), sign-in needs the
  // API on :3333, started with a fresh database and the dev sign-in, and
  // the public SSR site runs on :4300 from its production build.
  webServerCommands: {
    default:
      'npx nx run-many -t serve serve-e2e -p shell capitals flags api site',
    production:
      'npx nx run-many -t serve-static serve-e2e serve-ssr -p shell capitals flags api site',
  },
  ciWebServerCommand:
    'npx nx run-many -t serve-static serve-e2e serve-ssr -p shell capitals flags api site',
  ciBaseUrl: 'http://localhost:4200',
});

module.exports = defineConfig({
  e2e: {
    ...preset,
    async setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions,
    ) {
      on('task', {
        /**
         * The answer key for typed answers: the country dataset, read here
         * in Node (the spec bundler does not resolve workspace path aliases,
         * and the dataset stays out of the tests' browser bundle).
         */
        country(code: string) {
          // Node does not know the tsconfig path aliases, so the file is
          // required by its path; it only has a type-only import itself.
          const dataset =
            // eslint-disable-next-line @nx/enforce-module-boundaries
            require('../../libs/quiz/countries/src/lib/countries.data.ts');
          return (
            dataset.COUNTRIES.find(
              (country: { readonly code: string }) => country.code === code,
            ) ?? null
          );
        },
      });
      return preset.setupNodeEvents(on, config);
    },
    baseUrl: 'http://localhost:4200',
    video: false,
  },
});
