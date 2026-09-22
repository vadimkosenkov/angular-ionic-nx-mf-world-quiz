import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonIcon, IonInput } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@world-quiz/client/auth';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore, SyncService } from '@world-quiz/client/progress';
import { nicknameSchema } from '@world-quiz/shared/contracts';

/**
 * Settings → Account: who is signed in, whether their results are saved to
 * the account, sign out, delete the account (required in-app by App Store
 * Review Guideline 5.1.1(v)).
 *
 * Signing out deletes the account's data from this device (ADR-006). Results
 * not yet sent are tried once more first; if they still cannot be sent, the
 * player is told how many would be lost and decides.
 *
 * Confirmations are inline rather than modal alerts, so the consequence is
 * spelled out next to the button that causes it.
 */
@Component({
  selector: 'wq-account-section',
  imports: [IonButton, IonIcon, IonInput, TranslocoPipe, PluralPipe],
  templateUrl: './account-section.html',
  styleUrl: './account-section.scss',
})
export class AccountSection {
  protected readonly auth = inject(AuthStore);
  protected readonly progress = inject(ProgressStore);
  protected readonly sync = inject(SyncService);

  protected readonly confirming = signal<'delete' | 'sign-out' | null>(null);
  protected readonly signingOut = signal(false);
  protected readonly editingNickname = signal(false);
  protected readonly nicknameDraft = signal('');
  /** The API's own rules, checked before sending. */
  protected readonly nicknameValid = computed(
    () => nicknameSchema.safeParse(this.nicknameDraft()).success,
  );

  /** The provider of the current sign-in, for "Signed in with …". */
  protected readonly provider = computed(
    () => this.auth.user()?.providers[0] ?? 'google',
  );

  /**
   * What the player should know about their results. "All saved" is not
   * claimed while some result was refused (that is said separately).
   */
  protected readonly syncState = computed(() => {
    if (this.sync.status() === 'syncing') return 'saving';
    if (this.progress.pendingCount() > 0) return 'pending';
    return this.progress.rejectedCount() > 0 ? 'refused' : 'saved';
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
    if (await this.auth.setNickname(this.nicknameDraft())) {
      this.editingNickname.set(false);
    }
  }

  protected retry(): void {
    void this.auth.restore();
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    try {
      await this.sync.sync();
      if (this.progress.pendingCount() > 0) {
        this.confirming.set('sign-out');
        return;
      }
      await this.signOutAndForget();
    } finally {
      this.signingOut.set(false);
    }
  }

  protected async signOutAndForget(): Promise<void> {
    this.confirming.set(null);
    await this.auth.signOut();
    await this.progress.forget();
  }

  protected async deleteAccount(): Promise<void> {
    if (!(await this.auth.deleteAccount())) return;
    this.confirming.set(null);
    await this.progress.forget();
  }
}
