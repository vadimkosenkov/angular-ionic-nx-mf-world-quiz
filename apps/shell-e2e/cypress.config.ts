// CommonJS on purpose: Nx evaluates this file with Node's native TypeScript
// stripping, where ES module syntax would make `__filename` unavailable.
const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      // The shell alone is not enough: each quiz is served by its own
      // application, and the shell loads Capitals from http://localhost:4201
      // and Flags from http://localhost:4202.
      webServerCommands: {
        default: 'npx nx run-many -t serve -p shell capitals flags',
        production: 'npx nx run-many -t serve-static -p shell capitals flags',
      },
      ciWebServerCommand:
        'npx nx run-many -t serve-static -p shell capitals flags',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    video: false,
  },
});
