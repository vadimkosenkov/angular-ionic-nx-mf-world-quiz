import { inject, Injectable, InjectionToken } from '@angular/core';
import { SettingsStore } from '@world-quiz/client/settings';

/** The moments the app answers with a sound and a tap. */
export type FeedbackEvent =
  /** The answer was right. */
  | 'correct'
  /** The answer was wrong. */
  | 'incorrect'
  /** A round is over. */
  | 'finished'
  /** A round is over and every answer was right, or a record was set. */
  | 'celebrate';

/**
 * Sound. Implemented with the Web Audio API rather than audio files: the
 * tones are two notes long, an asset would be a download and a decode, and
 * files would have to ship in the app bundle as well.
 */
export interface Tones {
  play(event: FeedbackEvent): Promise<void>;
}

/**
 * Haptics — the iPhone's taptic engine. There is nothing to do on the web:
 * `navigator.vibrate` does not exist in Safari, and a browser that has it
 * buzzes the whole phone, which is not the same thing at all.
 */
export interface Haptics {
  tap(event: FeedbackEvent): Promise<void>;
}

/**
 * Both default to doing nothing, so a test, a server render or an app that
 * never calls `provideFeedback()` stays silent instead of failing to build
 * an injector.
 */
export const TONES = new InjectionToken<Tones>('TONES', {
  providedIn: 'root',
  factory: (): Tones => ({ play: () => Promise.resolve() }),
});

export const HAPTICS = new InjectionToken<Haptics>('HAPTICS', {
  providedIn: 'root',
  factory: (): Haptics => ({ tap: () => Promise.resolve() }),
});

/**
 * What the app plays when something happens, and the player's say over it.
 *
 * Both channels are optional and independent: a player can keep the taps and
 * turn the sound off (`SettingsStore`). Failures are swallowed — a browser
 * that refuses to make a sound must never break a quiz.
 */
@Injectable({ providedIn: 'root' })
export class Feedback {
  private readonly settings = inject(SettingsStore);
  private readonly tones = inject(TONES);
  private readonly haptics = inject(HAPTICS);

  play(event: FeedbackEvent): void {
    if (this.settings.sound()) void this.tones.play(event).catch(ignore);
    if (this.settings.haptics()) void this.haptics.tap(event).catch(ignore);
  }
}

const ignore = () => undefined;
