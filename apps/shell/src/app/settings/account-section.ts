import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonIcon, IonInput } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@world-quiz/client/auth';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore, SyncService } from '@world-quiz/client/progress';
import { Dialog, HoldButton, InfoButton } from '@world-quiz/client/ui';
import { nicknameSchema } from '@world-quiz/shared/contracts';
import { AccountNotices } from '../auth/account-notices';
import { RUNTIME_CONFIG } from '../runtime-config';

/**
 * Settings → Account: who is signed in, whether their results are saved to
 * the account, sign out, delete the account (required in-app by App Store
 * Review Guideline 5.1.1(v)).
 *
 * Signing out deletes the account's data from this device (ADR-006). Results
 * not yet sent are tried once more first; if they still cannot be sent, the
 * player is told how many would be lost and decides.
 *
 * Each of the three questions this card asks — a new name, signing out,
 * deleting the account — is a `wq-dialog` in the middle of the screen. They
 * used to be panels inside the card: it jumped a row taller as one opened,
 * and the consequence of a destructive action was spelled out in a strip
 * the eye had already learned to skip. How an action **turned out** is a
 * toast instead (`AccountNotices`).
 */
@Component({
  selector: 'wq-account-section',
  imports: [
    IonButton,
    IonIcon,
    IonInput,
    Dialog,
    HoldButton,
    InfoButton,
    TranslocoPipe,
    PluralPipe,
  ],
  templateUrl: './account-section.html',
  styleUrl: './account-section.scss',
})
export class AccountSection {
  protected readonly auth = inject(AuthStore);
  protected readonly progress = inject(ProgressStore);
  protected readonly sync = inject(SyncService);
  private readonly notices = inject(AccountNotices);

  /**
   * Whether this build shows the rehearsal button beside the real one. It
   * follows the development sign-in, which is what marks a build that is
   * being worked on rather than one a player has.
   */
  protected readonly rehearsing = inject(RUNTIME_CONFIG).devSignIn;

  protected readonly confirming = signal<'delete' | 'sign-out' | null>(null);
  protected readonly signingOut = signal(false);
  protected readonly editingNickname = signal(false);
  protected readonly nicknameDraft = signal('');
  /** The API's own rules, checked before sending. */
  protected readonly nicknameValid = computed(
    () => nicknameSchema.safeParse(this.nicknameDraft()).success,
  );

  /**
   * The rehearsal: everything the real hold does except the deleting, so
   * the way it looks and feels can be tried without an account to lose.
   */
  protected rehearseDelete(): void {
    console.log(1);
  }

  /** The provider of the current sign-in, for "Signed in with …". */
  protected readonly provider = computed(
    () => this.auth.user()?.providers[0] ?? 'google',
  );

  /**
   * The icon the identity row leads with: the mark of whatever the player
   * signed in through, because that is what the row is about. The
   * development sign-in has no mark of its own, so it keeps the generic
   * portrait.
   */
  protected readonly providerIcon = computed(() => {
    switch (this.provider()) {
      case 'google':
        return 'logo-google';
      case 'apple':
        return 'logo-apple';
      default:
        // The development sign-in. A mark of its own, or this row and the
        // one under it would lead with the same portrait.
        return 'construct';
    }
  });

  /**
   * What is worth saying about the results that have not reached the account
   * yet — `null` when there is nothing to say. The card used to carry a
   * permanent "all your results are saved" row, which is the normal state
   * and therefore no news; silence says it, and a refused result is said in
   * its own row.
   */
  protected readonly syncState = computed(() => {
    if (this.sync.status() === 'syncing') return 'saving';
    return this.progress.pendingCount() > 0 ? 'pending' : null;
  });

  protected editNickname(): void {
    this.nicknameDraft.set(this.auth.user()?.nickname ?? '');
    this.editingNickname.set(true);
  }

  // `ionInput` is a DOM event for Angular's strict templates.
  protected onNicknameInput(event: Event): void {
    this.nicknameDraft.set(
      String(
        (event as CustomEvent<{ value?: string | null }>).detail.value ?? '',
      ),
    );
  }

  /** The public name on leaderboards (never the provider's name). */
  protected async saveNickname(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.nicknameValid()) return;
    if (!(await this.auth.setNickname(this.nicknameDraft()))) {
      this.notices.failed();
      return;
    }
    this.editingNickname.set(false);
    this.notices.nicknameSaved();
  }

  protected retry(): void {
    void this.notices.retryRestore();
  }

  /**
   * Always asks first. Signing out deletes this account's results from the
   * device (ADR-006), which is as irreversible as deleting the account for
   * anything that has not reached the server — and the row sits one finger
   * away from the rest of Settings.
   *
   * What is waiting is sent once more before the question is asked, so the
   * warning about unsaved results is the truth at the moment it is read.
   */
  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.sync.sync();
    } finally {
      this.signingOut.set(false);
    }
    this.confirming.set('sign-out');
  }

  protected async signOutAndForget(): Promise<void> {
    this.confirming.set(null);
    await this.auth.signOut();
    await this.progress.forget();
    // Said after the app has left for the welcome screen: the toast lives
    // outside the router outlet, so it is still there to read.
    this.notices.signedOut();
  }

  protected async deleteAccount(): Promise<void> {
    if (!(await this.auth.deleteAccount())) {
      this.notices.failed();
      return;
    }
    this.confirming.set(null);
    await this.progress.forget();
    this.notices.accountDeleted();
  }
}
