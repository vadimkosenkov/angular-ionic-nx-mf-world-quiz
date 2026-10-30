import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createMemoryStorage,
  KEY_VALUE_STORAGE,
  type MemoryStorage,
} from '@world-quiz/client/settings';
import {
  TIPS_ENABLED_STORAGE_KEY,
  TIPS_STORAGE_KEY,
  TipsStore,
} from './tips.store';

function setup(
  stored?: Readonly<Record<string, string>>,
  override?: Partial<MemoryStorage>,
) {
  const reported: unknown[] = [];
  const storage = {
    ...createMemoryStorage({ ...stored }),
    ...override,
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: KEY_VALUE_STORAGE, useValue: storage },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => reported.push(error) },
      },
    ],
  });
  return { tips: TestBed.inject(TipsStore), storage, reported };
}

/** Lets the pending write run. */
const settle = () => new Promise((resolve) => setTimeout(resolve));

/** What a device that has been through the quiz setup's tour has stored. */
const seenSetup = { [TIPS_STORAGE_KEY]: '["setup"]' };

describe('TipsStore', () => {
  it('shows a tour the player has never walked', async () => {
    const { tips } = setup();
    await tips.load();

    expect(tips.shows('setup')).toBe(true);
  });

  it('remembers a tour that was walked', async () => {
    const { tips, storage } = setup();
    await tips.load();

    tips.dismiss('setup');
    await settle();

    expect(tips.shows('setup')).toBe(false);
    expect(storage.snapshot()[TIPS_STORAGE_KEY]).toBe('["setup"]');
  });

  it('keeps it away across restarts', async () => {
    const { tips } = setup(seenSetup);
    await tips.load();

    expect(tips.shows('setup')).toBe(false);
  });

  it('is on while a tour is still to come, and off once they are done', async () => {
    const { tips } = setup();
    await tips.load();
    expect(tips.on()).toBe(true);

    tips.dismiss('setup');

    // Nothing is going to appear any more, and the switch says so.
    expect(tips.on()).toBe(false);
  });

  it('walks every tour again when the switch is turned back on', async () => {
    const { tips, storage } = setup(seenSetup);
    await tips.load();
    expect(tips.on()).toBe(false);

    tips.setOn(true);
    await settle();

    expect(tips.shows('setup')).toBe(true);
    expect(storage.snapshot()[TIPS_STORAGE_KEY]).toBe('[]');
    expect(storage.snapshot()[TIPS_ENABLED_STORAGE_KEY]).toBe('true');
  });

  it('shows nothing once the player has turned the switch off', async () => {
    const { tips, storage } = setup();
    await tips.load();

    tips.setOn(false);
    await settle();

    expect(tips.on()).toBe(false);
    // Not "seen": a tour added in a later release stays off too.
    expect(tips.shows('setup')).toBe(false);
    expect(storage.snapshot()[TIPS_STORAGE_KEY]).toBe('[]');
    expect(storage.snapshot()[TIPS_ENABLED_STORAGE_KEY]).toBe('false');
  });

  it('remembers being turned off across restarts', async () => {
    const { tips } = setup({ [TIPS_ENABLED_STORAGE_KEY]: 'false' });
    await tips.load();

    expect(tips.shows('setup')).toBe(false);
    expect(tips.on()).toBe(false);
  });

  it('treats damaged or unknown stored values as nothing seen', async () => {
    for (const stored of ['not json', '{}', '["gone"]']) {
      const { tips, reported } = setup({ [TIPS_STORAGE_KEY]: stored });
      await tips.load();

      expect(tips.shows('setup')).toBe(true);
      // A tour shown once more is not worth reporting an error for.
      expect(reported).toEqual([]);
    }
  });

  it('survives storage it cannot read, and says so', async () => {
    const blocked = new Error('blocked');
    const { tips, reported } = setup(undefined, {
      get: () => Promise.reject(blocked),
    });

    await tips.load();

    // The screen still renders; the player sees the tour once more.
    expect(tips.shows('setup')).toBe(true);
    expect(reported).toEqual([blocked]);
  });
});
