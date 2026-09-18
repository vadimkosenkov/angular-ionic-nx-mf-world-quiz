// CommonJS on purpose: Nx evaluates this file with Node's native TypeScript
// stripping, where ES module syntax would make `__filename` unavailable.
const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      // The shell alone is not enough: the Capitals quiz is served by its own
      // application, and the shell loads it from http://localhost:4201.
      webServerCommands: {
        default: 'npx nx run-many -t serve -p shell capitals',
        production: 'npx nx run-many -t serve-static -p shell capitals',
      },
      ciWebServerCommand: 'npx nx run-many -t serve-static -p shell capitals',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    video: false,
  },
});
