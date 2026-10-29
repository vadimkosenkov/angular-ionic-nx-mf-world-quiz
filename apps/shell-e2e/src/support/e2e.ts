// Loaded automatically before every spec file. Shared custom commands are
// registered in ./commands.ts.
import './commands';
import { TIPS_KEY } from './commands';

/**
 * What every page in the suite starts with.
 *
 * *The first-run hints are already behind the device.* A fresh device gets
 * the quiz setup's guided tour, which stands where the Start button stands,
 * so every journey through that screen would have to walk the tour first.
 * The flag is written straight to the app's own storage key before the app
 * boots; `cy.showHints()` opts the spec about the hints out of it.
 *
 * *The tones are silent.* The specs play real quizzes in a real browser, so
 * every answer made a sound — a run beeped at whoever was sitting next to
 * the machine. The sound is switched off here rather than through the app's
 * own setting, because that setting is persisted and the specs that check
 * what survives a reload would then be testing the seed instead of the app.
 */
Cypress.on('window:before:load', (window) => {
  if (!Cypress.env('showHints')) {
    window.localStorage.setItem(TIPS_KEY, '["setup"]');
  }

  const noop = () => undefined;
  const gain = {
    gain: { setValueAtTime: noop, linearRampToValueAtTime: noop },
    connect: () => ({ connect: noop }),
  };
  class SilentAudioContext {
    readonly state = 'running';
    readonly currentTime = 0;
    readonly destination = {};
    resume = () => Promise.resolve();
    createGain = () => gain;
    createOscillator = () => ({
      type: '',
      frequency: { value: 0 },
      connect: () => gain,
      start: noop,
      stop: noop,
    });
  }
  (window as unknown as { AudioContext: unknown }).AudioContext =
    SilentAudioContext;
});
