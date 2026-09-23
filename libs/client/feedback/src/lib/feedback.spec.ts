import { TestBed } from '@angular/core/testing';
import {
  createMemoryStorage,
  DEVICE_LANGUAGES,
  KEY_VALUE_STORAGE,
  SETTINGS_STORAGE_KEY,
  SettingsStore,
  SYSTEM_PREFERS_DARK,
} from '@world-quiz/client/settings';
import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { Feedback, type FeedbackEvent, HAPTICS, TONES } from './feedback';

function setup(settings: { sound?: boolean; haptics?: boolean } = {}) {
  const played: FeedbackEvent[] = [];
  const tapped: FeedbackEvent[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: KEY_VALUE_STORAGE,
        useValue: createMemoryStorage({
          [SETTINGS_STORAGE_KEY]: JSON.stringify({
            theme: 'system',
            locale: 'en',
            sound: settings.sound ?? true,
            haptics: settings.haptics ?? true,
          }),
        }),
      },
      { provide: DEVICE_LANGUAGES, useValue: ['en'] },
      { provide: SYSTEM_PREFERS_DARK, useValue: signal(false).asReadonly() },
      {
        provide: TONES,
        useValue: {
          play: (event: FeedbackEvent) => {
            played.push(event);
            return Promise.resolve();
          },
        },
      },
      {
        provide: HAPTICS,
        useValue: {
          tap: (event: FeedbackEvent) => {
            tapped.push(event);
            return Promise.resolve();
          },
        },
      },
    ],
  });
  return { played, tapped };
}

const load = async () => {
  await TestBed.inject(SettingsStore).load();
  return TestBed.inject(Feedback);
};

describe('Feedback', () => {
  it('plays a tone and a tap for an event', async () => {
    const { played, tapped } = setup();

    (await load()).play('correct');

    expect(played).toEqual(['correct']);
    expect(tapped).toEqual(['correct']);
  });

  it('keeps the taps when the player turns the sound off', async () => {
    const { played, tapped } = setup({ sound: false });

    (await load()).play('incorrect');

    expect(played).toEqual([]);
    expect(tapped).toEqual(['incorrect']);
  });

  it('keeps the sound when the player turns the vibration off', async () => {
    const { played, tapped } = setup({ haptics: false });

    (await load()).play('finished');

    expect(played).toEqual(['finished']);
    expect(tapped).toEqual([]);
  });

  // A browser may refuse to make a sound (no gesture yet, autoplay policy).
  // Losing the answer's feedback is bad; losing the quiz would be worse.
  it('survives an implementation that fails', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: KEY_VALUE_STORAGE,
          useValue: createMemoryStorage({}),
        },
        { provide: DEVICE_LANGUAGES, useValue: ['en'] },
        { provide: SYSTEM_PREFERS_DARK, useValue: signal(false).asReadonly() },
        {
          provide: TONES,
          useValue: { play: () => Promise.reject(new Error('no audio')) },
        },
        {
          provide: HAPTICS,
          useValue: { tap: () => Promise.reject(new Error('no engine')) },
        },
      ],
    });

    expect(() => TestBed.inject(Feedback).play('celebrate')).not.toThrow();
  });
});
