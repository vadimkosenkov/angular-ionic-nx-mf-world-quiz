import type { FeedbackEvent, Tones } from './feedback';

/** Frequencies in hertz, played in order; `null` is a rest. */
const MELODIES: Record<FeedbackEvent, readonly number[]> = {
  // A rising major third: short, friendly, unmistakably "yes".
  correct: [660, 880],
  // A single low note, not a buzz: a wrong answer is information, not a
  // punishment, and the screen already says what the right one was.
  incorrect: [220],
  finished: [523, 659],
  // A small fanfare for a perfect run or a new record.
  celebrate: [523, 659, 784, 1047],
};

/** One note, in seconds. Long enough to hear, short enough to stay out of the way. */
const NOTE_SECONDS = 0.09;
/** How loud, relative to full scale. Kept low: this plays next to a thinking player. */
const PEAK_GAIN = 0.12;

interface AudioContextConstructor {
  new (): AudioContext;
}

/**
 * The tones, made in the browser.
 *
 * One `AudioContext` is created on first use and reused. Browsers start it
 * suspended until the player has interacted with the page, so every play
 * resumes it first; in a quiz the first sound always follows a tap anyway.
 */
export function webAudioTones(
  create: () => AudioContext = () =>
    new (window.AudioContext as unknown as AudioContextConstructor)(),
): Tones {
  let context: AudioContext | null = null;

  return {
    async play(event: FeedbackEvent) {
      const audio = (context ??= create());
      if (audio.state === 'suspended') await audio.resume();

      const start = audio.currentTime;
      MELODIES[event].forEach((frequency, index) => {
        const at = start + index * NOTE_SECONDS;
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        // A triangle wave is softer than a square and less thin than a sine.
        oscillator.type = 'triangle';
        oscillator.frequency.value = frequency;
        // Fade each note in and out, or the speaker clicks at both ends.
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(PEAK_GAIN, at + 0.01);
        gain.gain.linearRampToValueAtTime(0, at + NOTE_SECONDS);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(at);
        oscillator.stop(at + NOTE_SECONDS);
      });
    },
  };
}

/** Used where there is no Web Audio at all (server rendering, tests). */
export const silentTones: Tones = { play: () => Promise.resolve() };
