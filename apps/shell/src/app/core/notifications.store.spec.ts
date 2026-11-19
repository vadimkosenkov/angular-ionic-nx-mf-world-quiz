import { ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  createMemoryStorage,
  KEY_VALUE_STORAGE,
  type MemoryStorage,
} from '@world-quiz/client/settings';
import type { Friend } from '@world-quiz/shared/contracts';
import { FriendsStore } from '../friends/friends.store';
import { latestRelease, RELEASES } from '../release-notes/release-notes';
import {
  NotificationsStore,
  RELEASE_SEEN_STORAGE_KEY,
} from './notifications.store';

/**
 * Who is waiting to be friends is the only thing this store asks of the
 * friends: a stub keeps the spec from standing up the API's configuration
 * and an HTTP client for a list it never reads.
 */
function friendsWaiting(count: number): FriendsStore {
  const incoming = signal<readonly Friend[]>(
    Array.from({ length: count }, (_, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      nickname: `Player ${index}`,
      since: '2026-11-18T10:00:00.000Z',
    })),
  );
  return { incoming } as unknown as FriendsStore;
}

function setup(
  stored?: Readonly<Record<string, string>>,
  override?: Partial<MemoryStorage>,
  waiting = 0,
) {
  const reported: unknown[] = [];
  const storage = { ...createMemoryStorage({ ...stored }), ...override };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: KEY_VALUE_STORAGE, useValue: storage },
      { provide: FriendsStore, useValue: friendsWaiting(waiting) },
      {
        provide: ErrorHandler,
        useValue: { handleError: (error: unknown) => reported.push(error) },
      },
    ],
  });
  return {
    notifications: TestBed.inject(NotificationsStore),
    storage,
    reported,
  };
}

/** The release this build is, which is what the bell can be behind on. */
const current = latestRelease(RELEASES)?.version ?? '';

/** A version older than anything the build ships. */
const older = '0.0';

describe('NotificationsStore', () => {
  it('says nothing on a device that has never stored anything', async () => {
    // A new player is not behind on a release they have never seen; the
    // build they start on becomes the one they are level with.
    const { notifications, storage } = setup();
    await notifications.load();

    expect(notifications.unread()).toBe(false);
    expect(notifications.notifications()).toEqual([]);
    expect(storage.snapshot()[RELEASE_SEEN_STORAGE_KEY]).toBe(current);
  });

  it('carries a message about a release the player has not read', async () => {
    const { notifications } = setup({ [RELEASE_SEEN_STORAGE_KEY]: older });
    await notifications.load();

    expect(notifications.unread()).toBe(true);
    expect(notifications.notifications()).toEqual([
      { kind: 'release', version: current },
    ]);
  });

  it('says nothing once the notes have been read', async () => {
    const { notifications, storage } = setup({
      [RELEASE_SEEN_STORAGE_KEY]: older,
    });
    await notifications.load();

    await notifications.markReleasesRead();

    expect(notifications.unread()).toBe(false);
    expect(storage.snapshot()[RELEASE_SEEN_STORAGE_KEY]).toBe(current);
  });

  it('keeps quiet about a release it has already recorded', async () => {
    const writes: string[] = [];
    const { notifications } = setup(
      { [RELEASE_SEEN_STORAGE_KEY]: current },
      {
        async set(key, value) {
          writes.push(`${key}=${value}`);
        },
      },
    );
    await notifications.load();
    await notifications.markReleasesRead();

    expect(notifications.unread()).toBe(false);
    expect(writes).toEqual([]);
  });

  it('never records a release older than the one already read', async () => {
    // The same device can meet an older build than the one it has read
    // about — an installed web app still on the previous deployment, the
    // iPhone bundle behind the web. Writing that build's release over the
    // stored one would announce an already-read release after the upgrade.
    const ahead = '99.0';
    const { notifications, storage } = setup({
      [RELEASE_SEEN_STORAGE_KEY]: ahead,
    });
    await notifications.load();

    await notifications.markReleasesRead();

    expect(storage.snapshot()[RELEASE_SEEN_STORAGE_KEY]).toBe(ahead);
    expect(notifications.unread()).toBe(false);
  });

  it('puts people waiting to be friends before the release', async () => {
    // Somebody is waiting for an answer; the notes are not going anywhere.
    const { notifications } = setup(
      { [RELEASE_SEEN_STORAGE_KEY]: older },
      undefined,
      2,
    );
    await notifications.load();

    expect(notifications.unread()).toBe(true);
    expect(notifications.notifications()).toEqual([
      { kind: 'friend-requests', count: 2 },
      { kind: 'release', version: current },
    ]);
  });

  it('marks the bell for a friend request on a device with nothing to read', async () => {
    // A request carries no "seen" state: answering it is what clears it,
    // so reading the notes must not silence it.
    const { notifications } = setup(undefined, undefined, 1);
    await notifications.load();
    await notifications.markReleasesRead();

    expect(notifications.unread()).toBe(true);
    expect(notifications.notifications()).toEqual([
      { kind: 'friend-requests', count: 1 },
    ]);
  });

  it('reports storage it cannot read and shows nothing', async () => {
    const { notifications, reported } = setup(undefined, {
      async get() {
        throw new Error('no preferences here');
      },
    });
    await notifications.load();

    expect(reported).toHaveLength(1);
    expect(notifications.unread()).toBe(false);
  });

  it('reports storage it cannot write to but still clears the mark', async () => {
    // The message is gone for this session; it comes back on the next
    // start, which is the harmless half of the failure.
    const { notifications, reported } = setup(
      { [RELEASE_SEEN_STORAGE_KEY]: older },
      {
        async set() {
          throw new Error('read-only device');
        },
      },
    );
    await notifications.load();
    await notifications.markReleasesRead();

    expect(notifications.unread()).toBe(false);
    expect(reported).toHaveLength(1);
  });
});
