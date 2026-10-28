import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@world-quiz/client/auth';
import { Toasts } from '@world-quiz/client/ui';

/**
 * Says how an account action turned out, in one place.
 *
 * Both screens that run these actions — the welcome screen and Settings —
 * report them the same way, and the texts of `AuthStore`'s errors are chosen
 * once here instead of in each template. `Toasts` takes finished sentences:
 * `client/ui` carries no translations.
 */
@Injectable({ providedIn: 'root' })
export class AccountNotices {
  private readonly auth = inject(AuthStore);
  private readonly toasts = inject(Toasts);
  private readonly transloco = inject(TranslocoService);

  /** The error of the action that has just failed, if it set one. */
  failed(): void {
    const error = this.auth.error();
    if (error) {
      this.toasts.failure(
        this.transloco.translate(`settings.account.errors.${error}`),
      );
    }
  }

  /**
   * Checks an unverified sign-in again (the "Try again" button on the welcome
   * screen and in Settings). Success shows itself — the screen turns into the
   * signed-in one — but a second failure changes nothing on screen, so it is
   * said out loud; otherwise the button looks broken.
   */
  async retryRestore(): Promise<void> {
    await this.auth.restore();
    if (this.auth.status() === 'unverified') {
      this.toasts.failure(
        this.transloco.translate('settings.account.errors.unreachable'),
      );
    }
  }

  nicknameSaved(): void {
    this.confirm('settings.account.nickname.saved');
  }

  signedOut(): void {
    this.confirm('settings.account.signedOut');
  }

  accountDeleted(): void {
    this.confirm('settings.account.deleted');
  }

  private confirm(key: string): void {
    this.toasts.success(this.transloco.translate(key));
  }
}
