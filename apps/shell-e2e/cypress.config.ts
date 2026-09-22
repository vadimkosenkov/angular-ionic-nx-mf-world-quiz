// CommonJS on purpose: Nx evaluates this file with Node's native TypeScript
// stripping, where ES module syntax would make `__filename` unavailable.
const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      // The shell alone is not enough: each quiz is served by its own
      // application (Capitals on :4201, Flags on :4202), and sign-in needs the
      // API on :3333, started with a fresh database and the dev sign-in.
      webServerCommands: {
        default:
          'npx nx run-many -t serve serve-e2e -p shell capitals flags api',
        production:
          'npx nx run-many -t serve-static serve-e2e -p shell capitals flags api',
      },
      ciWebServerCommand:
        'npx nx run-many -t serve-static serve-e2e -p shell capitals flags api',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    video: false,
  },
});
