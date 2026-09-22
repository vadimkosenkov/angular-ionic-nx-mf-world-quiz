import { Component, computed, inject, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AuthStore,
  type GoogleCredential,
  GoogleSignInButton,
} from '@world-quiz/client/auth';
import { SettingsStore } from '@world-quiz/client/settings';

/**
 * Settings → Account: sign in, see who is signed in, sign out, delete the
 * account (required in-app by App Store Review Guideline 5.1.1(v)).
 *
 * Deleting asks for confirmation inline rather than in a modal alert, so the
 * consequence is spelled out next to the button that causes it.
 */
@Component({
  selector: 'wq-account-section',
  imports: [IonButton, IonIcon, TranslocoPipe, GoogleSignInButton],
  templateUrl: './account-section.html',
  styleUrl: './account-section.scss',
})
export class AccountSection {
  protected readonly auth = inject(AuthStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly confirmingDelete = signal(false);

  /** The provider of the current sign-in, for "Signed in with …". */
  protected readonly provider = computed(
    () => this.auth.user()?.providers[0] ?? 'google',
  );

  protected signInWithGoogle({ idToken, nonce }: GoogleCredential): void {
    void this.auth.signIn('google', idToken, nonce);
  }

  protected retry(): void {
    void this.auth.restore();
  }

  protected signOut(): void {
    void this.auth.signOut();
  }

  protected async deleteAccount(): Promise<void> {
    if (await this.auth.deleteAccount()) this.confirmingDelete.set(false);
  }
}
