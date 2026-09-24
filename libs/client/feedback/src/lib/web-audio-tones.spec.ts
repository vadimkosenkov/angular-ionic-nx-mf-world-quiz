import { describe, expect, it } from 'vitest';
import { webAudioTones } from './web-audio-tones';

/** Records what was scheduled, without making a sound. */
function fakeAudioContext(state: AudioContextState = 'running') {
  const notes: { frequency: number; startedAt: number }[] = [];
  let resumed = 0;
  const gain = {
    gain: {
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
    },
    connect: () => undefined,
  };
  const context = {
    state,
    currentTime: 10,
    destination: {},
    resume: () => {
      resumed += 1;
      context.state = 'running';
      return Promise.resolve();
    },
    createGain: () => gain,
    createOscillator: () => {
      const oscillator = {
        type: '',
        frequency: { value: 0 },
        connect: () => gain,
        start: (at: number) =>
          notes.push({ frequency: oscillator.frequency.value, startedAt: at }),
        stop: () => undefined,
      };
      return oscillator;
    },
  };
  return {
    notes,
    resumedTimes: () => resumed,
    createdTimes: 0,
    context: context as unknown as AudioContext,
  };
}

describe('webAudioTones', () => {
  it('plays the notes of an event in order', async () => {
    const audio = fakeAudioContext();

    await webAudioTones(() => audio.context).play('correct');

    expect(audio.notes.map((note) => note.frequency)).toEqual([660, 880]);
    // The second note starts after the first, not on top of it.
    expect(audio.notes[1]?.startedAt).toBeGreaterThan(
      audio.notes[0]?.startedAt ?? 0,
    );
  });

  // Browsers start an audio context suspended until the page has been
  // touched; in a quiz the first sound always follows a tap, but the
  // context still has to be resumed.
  it('resumes a suspended context first', async () => {
    const audio = fakeAudioContext('suspended');

    await webAudioTones(() => audio.context).play('incorrect');

    expect(audio.resumedTimes()).toBe(1);
    expect(audio.notes).toHaveLength(1);
  });

  it('creates the audio context once, not per sound', async () => {
    const audio = fakeAudioContext();
    let created = 0;
    const tones = webAudioTones(() => {
      created += 1;
      return audio.context;
    });

    await tones.play('correct');
    await tones.play('celebrate');

    expect(created).toBe(1);
    expect(audio.notes).toHaveLength(2 + 4);
  });
});
