import { Component, inject } from '@angular/core';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AuthStore,
  type GoogleCredential,
  GoogleSignInButton,
} from '@world-quiz/client/auth';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore } from '@world-quiz/client/progress';
import { SettingsStore } from '@world-quiz/client/settings';
import { TRAINING_MODES } from '@world-quiz/quiz/domain';
import { NATIVE_PLATFORM } from '../core/platform';

/**
 * The first screen: what the app is, and signing in. Playing needs an account
 * (ADR-011), so the tabs open only after sign-in.
 */
@Component({
  selector: 'wq-welcome-page',
  imports: [
    IonButton,
    IonContent,
    IonIcon,
    TranslocoPipe,
    PluralPipe,
    GoogleSignInButton,
  ],
  templateUrl: './welcome.page.html',
  styleUrl: './welcome.page.scss',
})
export class WelcomePage {
  protected readonly auth = inject(AuthStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly progress = inject(ProgressStore);
  private readonly nav = inject(NavController);

  protected readonly modeCount = TRAINING_MODES.length;
  /**
   * Google's sign-in runs in Google's own page, which Google refuses to show
   * inside an app's web view, so the iPhone app needs a native sign-in — it
   * does not exist yet, and the screen says so instead of offering a button
   * that cannot work.
   */
  protected readonly nativePlatform = inject(NATIVE_PLATFORM);

  protected async signInWithGoogle({
    idToken,
    nonce,
  }: GoogleCredential): Promise<void> {
    if (!(await this.auth.signIn('google', idToken, nonce))) return;
    const user = this.auth.user();
    if (user) await this.progress.claim(user);
    await this.nav.navigateRoot('/home');
  }

  protected retry(): void {
    void this.auth.restore();
  }
}
