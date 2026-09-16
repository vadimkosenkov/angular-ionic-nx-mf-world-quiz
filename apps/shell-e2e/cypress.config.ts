// CommonJS on purpose: Nx evaluates this file with Node's native TypeScript
// stripping, where ES module syntax would make `__filename` unavailable.
const { nxE2EPreset } = require('@nx/cypress/plugins/cypress-preset');
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      webServerCommands: {
        default: 'npx nx run shell:serve',
        production: 'npx nx run shell:serve-static',
      },
      ciWebServerCommand: 'npx nx run shell:serve-static',
      ciBaseUrl: 'http://localhost:4200',
    }),
    baseUrl: 'http://localhost:4200',
    video: false,
  },
});
