import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The iOS application (Phase 13). Capacitor wraps the **shell**; the quiz
 * remotes are copied into the same bundle by
 * `tools/scripts/build-ios-bundle.mjs`, so the app works offline and the App
 * Store review never sees code loaded from the network (ADR-002, ADR-013).
 *
 * `webDir` is that assembled folder, not the plain browser build.
 */
const config: CapacitorConfig = {
  appId: 'com.worldquiz.app',
  appName: 'World Quiz',
  webDir: '../../dist/apps/shell/ios-www',
  ios: {
    // The quiz is portrait-first and its own theme decides the colours.
    contentInset: 'never',
  },
};

export default config;
