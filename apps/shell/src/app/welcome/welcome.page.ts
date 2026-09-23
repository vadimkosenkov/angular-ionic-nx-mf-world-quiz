import { Component, inject } from '@angular/core';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AuthStore,
  type GoogleCredential,
  GoogleSignInButton,
  NATIVE_SIGN_IN,
} from '@world-quiz/client/auth';
import { PluralPipe } from '@world-quiz/client/i18n';
import { ProgressStore } from '@world-quiz/client/progress';
import { SettingsStore } from '@world-quiz/client/settings';
import { TRAINING_MODES } from '@world-quiz/quiz/domain';
import { NATIVE_PLATFORM } from '../core/platform';
import { RUNTIME_CONFIG } from '../runtime-config';

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
  /** The system's own sign-in; `null` when this build has none. */
  protected readonly nativeSignIn = inject(NATIVE_SIGN_IN);
  protected readonly devSignIn = inject(RUNTIME_CONFIG).devSignIn;

  protected async signInWithGoogle({
    idToken,
    nonce,
  }: GoogleCredential): Promise<void> {
    if (!(await this.auth.signIn('google', idToken, nonce))) return;
    const user = this.auth.user();
    if (user) await this.progress.claim(user);
    await this.nav.navigateRoot('/home');
  }

  /**
   * iOS shows Google's own account sheet; the app receives an ID token and
   * hands it to the API, exactly as the web button does. A cancelled sign-in
   * is not an error: the player simply closed the sheet.
   */
  protected async signInNatively(): Promise<void> {
    const credential = await this.nativeSignIn?.signIn().catch(() => null);
    if (!credential) return;
    await this.signInWithGoogle({
      idToken: credential.idToken,
      nonce: credential.nonce,
    });
  }

  /** Only in a build that enables it, against an API that allows it. */
  protected async signInForDevelopment(): Promise<void> {
    if (!(await this.auth.signInForDevelopment(`ios-${crypto.randomUUID()}`)))
      return;
    const user = this.auth.user();
    if (user) await this.progress.claim(user);
    await this.nav.navigateRoot('/home');
  }

  protected retry(): void {
    void this.auth.restore();
  }
}
