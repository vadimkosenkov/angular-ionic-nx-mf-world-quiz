import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import type { Friend } from '@world-quiz/shared/contracts';
import { provideShellTesting } from '../../testing/shell-testing';
import { FriendsStore } from '../friends/friends.store';
import {
  NotificationsStore,
  RELEASE_SEEN_STORAGE_KEY,
} from '../core/notifications.store';
import { latestRelease, RELEASES } from '../release-notes/release-notes';
import { NotificationBell } from './notification-bell';

const current = latestRelease(RELEASES)?.version ?? '';

/** A device that last read about a release older than this build. */
const behind = { [RELEASE_SEEN_STORAGE_KEY]: '0.0' };

/** Ionic's popover is not upgraded in jsdom, so its inputs are properties. */
const popover = () =>
  document.querySelector('ion-popover') as HTMLElement & {
    isOpen?: boolean;
    event?: Event;
  };

const WAITING: Friend = {
  id: '2f0e6b8f-0000-4000-8000-000000000002',
  nickname: 'Boris',
  since: '2026-11-18T10:00:00.000Z',
};

async function renderBell(
  storage?: Readonly<Record<string, string>>,
  incoming: readonly Friend[] = [],
) {
  const rendered = await render(NotificationBell, {
    providers: [
      ...provideShellTesting({ storage }),
      {
        provide: FriendsStore,
        useValue: { incoming: signal(incoming) } as unknown as FriendsStore,
      },
    ],
  });
  // The store is loaded by an app initializer in the app itself.
  await TestBed.inject(NotificationsStore).load();
  rendered.fixture.detectChanges();
  return rendered;
}

describe('NotificationBell', () => {
  it('is a plain bell, and says so, when there is nothing to read', async () => {
    await renderBell({ [RELEASE_SEEN_STORAGE_KEY]: current });

    expect(screen.getByTestId('notifications').getAttribute('aria-label')).toBe(
      'Messages',
    );
    expect(screen.queryByTestId('notifications-dot')).toBeNull();
  });

  it('carries a mark, and a name that says so, when a release is unread', async () => {
    await renderBell(behind);

    expect(screen.getByTestId('notifications-dot')).toBeTruthy();
    // The mark is a dot; what it means is in the button's name, because a
    // colour on its own says nothing to a screen reader.
    expect(screen.getByTestId('notifications').getAttribute('aria-label')).toBe(
      'Messages, one unread',
    );
  });

  it('keeps the list away until the bell is pressed, and points it there', async () => {
    // What the list says is checked in Cypress: Ionic's popover does not
    // upgrade in jsdom, so its content is never rendered here.
    const { fixture } = await renderBell(behind);

    expect(popover().isOpen).toBe(false);

    screen.getByTestId('notifications').click();
    fixture.detectChanges();

    expect(popover().isOpen).toBe(true);
    expect(popover().event).toBeInstanceOf(Event);
  });

  it('has a message about the release, which the list renders', async () => {
    const { fixture } = await renderBell(behind);
    const store = TestBed.inject(NotificationsStore);
    fixture.detectChanges();

    expect(store.notifications()).toEqual([
      { kind: 'release', version: current },
    ]);
  });

  it('carries the mark for a friend request on a device with nothing to read', async () => {
    const { fixture } = await renderBell(
      { [RELEASE_SEEN_STORAGE_KEY]: current },
      [WAITING],
    );
    const store = TestBed.inject(NotificationsStore);
    fixture.detectChanges();

    expect(screen.getByTestId('notifications-dot')).toBeTruthy();
    expect(store.notifications()).toEqual([
      { kind: 'friend-requests', count: 1 },
    ]);
  });
});
