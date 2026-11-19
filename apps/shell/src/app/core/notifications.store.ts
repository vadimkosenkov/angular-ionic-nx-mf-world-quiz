import {
  computed,
  type EnvironmentProviders,
  ErrorHandler,
  inject,
  Injectable,
  makeEnvironmentProviders,
  provideAppInitializer,
  signal,
} from '@angular/core';
import { KEY_VALUE_STORAGE } from '@world-quiz/client/settings';
import { FriendsStore } from '../friends/friends.store';
import {
  compareVersions,
  hasUnreadRelease,
  latestRelease,
  RELEASES,
} from '../release-notes/release-notes';

/** The release the player has already read about. */
export const RELEASE_SEEN_STORAGE_KEY = 'world-quiz.release.seen';

/**
 * Something the app has to say to the player, as opposed to the outcome of
 * something they just did (that is a toast, design-system.md).
 *
 * There are two kinds. A release the player has not read about is the
 * device's own business and is cleared by reading it; people waiting to be
 * friends is the account's, and it is cleared by answering them — so this
 * one carries no "seen" state at all, and leaves the list the moment the
 * requests are dealt with.
 */
export type AppNotification =
  | {
      readonly kind: 'release';
      /** The release this message is about, e.g. `0.4`. */
      readonly version: string;
    }
  | {
      readonly kind: 'friend-requests';
      /** How many people are waiting for an answer; never zero. */
      readonly count: number;
    };

/**
 * What the bell on Home holds.
 *
 * The one thing it knows today is whether the build is a release the player
 * has not read about yet. That belongs to the **device**, like the tours and
 * the last quiz setup: having read what changed is not an account's property,
 * and signing out does not make it unread. Hence `KEY_VALUE_STORAGE`
 * (Capacitor Preferences) rather than the account's own data.
 *
 * The first run of a device stores the current release without announcing
 * it. A player who has just installed the app, or who arrives from a build
 * that had no such screen, is not behind on anything, and a message
 * inviting them to read what changed before they have seen anything at all
 * says nothing. From the next release onwards the bell works for everyone.
 *
 * Nothing here throws: storage that cannot be read costs a message shown
 * once more, which is not worth failing a screen for.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly storage = inject(KEY_VALUE_STORAGE);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly friends = inject(FriendsStore);

  private readonly seenState = signal<string | null>(null);

  /** Everything the bell shows: what somebody is waiting for first. */
  readonly notifications = computed<readonly AppNotification[]>(() => {
    const messages: AppNotification[] = [];
    const waiting = this.friends.incoming().length;
    if (waiting > 0) {
      messages.push({ kind: 'friend-requests', count: waiting });
    }
    const release = latestRelease(RELEASES);
    if (release && hasUnreadRelease(this.seenState(), RELEASES)) {
      messages.push({ kind: 'release', version: release.version });
    }
    return messages;
  });

  /** Whether the bell carries its mark. */
  readonly unread = computed(() => this.notifications().length > 0);

  /** Reads what has been read, once, before the first render. */
  async load(): Promise<void> {
    try {
      const seen = await this.storage.get(RELEASE_SEEN_STORAGE_KEY);
      if (seen) {
        this.seenState.set(seen);
        return;
      }
      // A device with nothing stored starts level with the build it is on.
      const current = latestRelease(RELEASES);
      if (current) await this.markReleaseRead(current.version);
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  /**
   * The player has opened the release notes. Reading is what clears the
   * mark — opening the bell is not, or the mark would go while the page it
   * points at was never seen.
   */
  async markReleasesRead(): Promise<void> {
    const current = latestRelease(RELEASES);
    if (!current) return;
    // Never backwards. The same device can meet an older build than the one
    // it has already read about — an installed web app still serving the
    // previous deployment, the iPhone bundle behind the web — and writing
    // that build's release over the stored one would make the bell announce
    // an already-read release again after the upgrade.
    const seen = this.seenState();
    if (seen && compareVersions(current.version, seen) <= 0) return;
    await this.markReleaseRead(current.version);
  }

  private async markReleaseRead(version: string): Promise<void> {
    this.seenState.set(version);
    try {
      await this.storage.set(RELEASE_SEEN_STORAGE_KEY, version);
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }
}

/**
 * Loads the bell's state before the first render, so a mark the player
 * cleared long ago does not appear for a frame on the way to Home.
 */
export function provideNotifications(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => inject(NotificationsStore).load()),
  ]);
}
