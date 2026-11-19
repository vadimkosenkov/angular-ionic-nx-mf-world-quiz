import { Component, effect, inject, input, untracked } from '@angular/core';
import { IonContent, NavController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@world-quiz/client/auth';
import { PageChromeState, PageHeader } from '@world-quiz/client/ui';
import { FriendsStore } from './friends.store';

/**
 * Where an invite link lands.
 *
 * The link is the one address a player can arrive at without an account —
 * it is usually sent to somebody who does not have the app yet — so this
 * route is not behind the sign-in guard. It shows nothing of the app: it
 * writes the code down, sends the player where they belong, and the request
 * is made as soon as there is an account to make it from.
 *
 * Signing in takes time (and, on the web, a round trip to Google), so the
 * code outlives this page in the device's own storage rather than in a
 * signal (`FriendsStore.rememberInvite`).
 */
@Component({
  selector: 'wq-invite-page',
  imports: [IonContent, PageHeader, TranslocoPipe],
  providers: [PageChromeState],
  template: `
    <wq-page-header [heading]="'friends.invite.title' | transloco" />
    <ion-content [fullscreen]="true" class="wq-aurora">
      <div class="wq-page">
        <p class="wq-text-secondary">
          {{ 'friends.invite.landing' | transloco }}
        </p>
      </div>
    </ion-content>
  `,
})
export class InvitePage {
  private readonly auth = inject(AuthStore);
  private readonly nav = inject(NavController);
  private readonly store = inject(FriendsStore);

  /** The code from the link, bound by `withComponentInputBinding()`. */
  readonly code = input.required<string>();

  constructor() {
    // An effect rather than the constructor body: the code arrives from the
    // route after the component is built (`withComponentInputBinding()`),
    // and a required input read too early throws instead of waiting.
    effect(() => {
      const code = this.code();
      untracked(() => void this.land(code));
    });
  }

  private async land(code: string): Promise<void> {
    await this.store.rememberInvite(code);
    // A sign-in that is still being restored decides nothing yet: whoever
    // the player turns out to be, the code is written down and the store
    // sends the request when an account appears.
    await this.auth.whenRestored();
    await this.nav.navigateRoot(this.auth.signedIn() ? '/friends' : '/welcome');
  }
}
