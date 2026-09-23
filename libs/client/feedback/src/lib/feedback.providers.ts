import {
  type EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';
import { capacitorHaptics, noHaptics } from './capacitor-haptics';
import { HAPTICS, TONES } from './feedback';
import { webAudioTones } from './web-audio-tones';

/**
 * Sound and haptics for the app. Haptics exist only on the device, so the
 * web gets the implementation that does nothing rather than a pretend one.
 */
export function provideFeedback(options: {
  readonly native: boolean;
}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: TONES, useFactory: () => webAudioTones() },
    {
      provide: HAPTICS,
      useValue: options.native ? capacitorHaptics() : noHaptics,
    },
  ]);
}
