import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SettingsStore } from '@world-quiz/client/settings';
import {
  EmptyState,
  PageChromeState,
  PageHeader,
  Toasts,
} from '@world-quiz/client/ui';
import type { Friend } from '@world-quiz/shared/contracts';
import { friendInitial, friendSince } from './friend-rows';
import { FriendsStore } from './friends.store';
import { InviteDialog } from './invite-dialog';

/** A row of one of the lists, with everything it needs already in words. */
interface FriendRow {
  readonly friend: Friend;
  readonly initial: string;
  readonly since: string;
}

/**
 * Who the player knows: the requests waiting for an answer, and the friends
 * themselves (ADR-015).
 *
 * It is pushed over the tabs from Home's Friends card, like the countries
 * reference — a place the player goes to do something and then leaves, not
 * a tab to come back to.
 *
 * The invite lives behind the button in the corner, so that the list — the
 * thing the screen is about every time after the first — starts at the top.
 * An empty list says what the button is for, which is the one moment the
 * invite is the point of the screen.
 */
@Component({
  selector: 'wq-friends-page',
  imports: [
    EmptyState,
    IonButton,
    IonContent,
    IonIcon,
    InviteDialog,
    PageHeader,
    TranslocoPipe,
  ],
  providers: [PageChromeState],
  templateUrl: './friends.page.html',
  styleUrl: './friends.page.scss',
})
export class FriendsPage {
  private readonly nav = inject(NavController);
  private readonly settings = inject(SettingsStore);
  private readonly transloco = inject(TranslocoService);
  private readonly toasts = inject(Toasts);

  protected readonly store = inject(FriendsStore);

  /** Whether the invite is open. */
  protected readonly inviting = signal(false);

  protected readonly incoming = computed(() =>
    this.rowsOf(this.store.incoming()),
  );
  protected readonly friends = computed(() =>
    this.rowsOf(this.store.friends()),
  );
  protected readonly outgoing = computed(() =>
    this.rowsOf(this.store.outgoing()),
  );

  /** Nobody at all: no friends, nobody waiting, nobody asked. */
  protected readonly empty = computed(
    () =>
      this.store.lists.hasValue() &&
      this.incoming().length === 0 &&
      this.friends().length === 0 &&
      this.outgoing().length === 0,
  );

  /** The lists could not be fetched — offline, or the API is down. */
  protected readonly failed = computed(
    () => this.store.lists.error() !== undefined,
  );

  protected async open(friend: Friend): Promise<void> {
    await this.nav.navigateForward(`/friends/${friend.id}`);
  }

  protected async accept(friend: Friend): Promise<void> {
    const done = await this.store.accept(friend.id);
    this.toasts[done ? 'success' : 'failure'](
      this.transloco.translate(
        done ? 'friends.requests.accepted' : 'friends.failed',
        { name: friend.nickname },
      ),
    );
  }

  /**
   * Says no to a request, or takes back one this player sent. Ending a
   * friendship is the same call, but it is asked for on the friend's own
   * page, where there is something to look at before deciding.
   */
  protected async remove(friend: Friend): Promise<void> {
    const done = await this.store.remove(friend.id);
    this.toasts[done ? 'success' : 'failure'](
      this.transloco.translate(
        done ? 'friends.requests.declined' : 'friends.failed',
        { name: friend.nickname },
      ),
    );
  }

  private rowsOf(friends: readonly Friend[]): readonly FriendRow[] {
    const locale = this.settings.locale();
    return friends.map((friend) => ({
      friend,
      initial: friendInitial(friend.nickname),
      since: friendSince(friend.since, locale),
    }));
  }
}
