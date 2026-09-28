// Loaded automatically before every spec file. Shared custom commands are
// registered in ./commands.ts.
import './commands';

/**
 * Silence the app's tones for the whole suite.
 *
 * The specs play real quizzes in a real browser, so every answer made a
 * sound — a run beeped at whoever was sitting next to the machine. The
 * sound is switched off here rather than through the app's own setting,
 * because that setting is persisted and the specs that check what survives
 * a reload would then be testing the seed instead of the app.
 */
Cypress.on('window:before:load', (window) => {
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
