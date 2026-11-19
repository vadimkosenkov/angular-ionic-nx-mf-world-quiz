import { Component, computed, inject, output, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { APP_URL } from '@world-quiz/client/quiz-ports';
import {
  Dialog,
  QrCode,
  SHARE_TARGET,
  shareLines,
  Toasts,
} from '@world-quiz/client/ui';
import { FriendsStore } from './friends.store';

/**
 * The invite: the player's own code as a QR, as a link to share, and the
 * field for somebody else's code.
 *
 * It is a dialog rather than the top of the friends screen (ADR-015, the
 * phase notes): the screen is the list of people, and an invite is
 * something a player does once and then rarely — a card holding the top of
 * the screen for ever would push the list half a screen down.
 *
 * Both halves of the exchange are here on purpose. "Here is mine" and "here
 * is theirs" are the same moment, usually with the two phones side by side,
 * and splitting them over two screens would mean guessing which way round
 * this particular pair is doing it.
 */
@Component({
  selector: 'wq-invite-dialog',
  imports: [Dialog, QrCode, IonButton, IonIcon, TranslocoPipe],
  templateUrl: './invite-dialog.html',
  styleUrl: './invite-dialog.scss',
})
export class InviteDialog {
  private readonly transloco = inject(TranslocoService);
  private readonly shareTarget = inject(SHARE_TARGET);
  private readonly toasts = inject(Toasts);
  /** Where this deployment lives; the invite link is built on it. */
  private readonly appUrl = inject(APP_URL);

  protected readonly store = inject(FriendsStore);

  /** The dialog asked to close. */
  readonly dismissed = output<void>();

  protected readonly typed = signal('');
  protected readonly error = signal<string | null>(null);

  protected readonly code = this.store.inviteCode;

  /**
   * The address that opens the app on this invite. Without an `appUrl` —
   * a build that was not told where it lives — there is no link to give,
   * and the code itself is what travels.
   */
  protected readonly link = computed(() => {
    const code = this.code();
    return this.appUrl && code ? `${this.appUrl}/invite/${code}` : null;
  });

  /** The code in two halves: eight characters in a row are hard to read. */
  protected readonly spacedCode = computed(() => {
    const code = this.code();
    return code ? `${code.slice(0, 4)} ${code.slice(4)}` : '';
  });

  protected onTyped(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  /** Hands the invite to the share sheet, or to the clipboard. */
  protected async share(): Promise<void> {
    const code = this.code();
    if (!code) return;
    const link = this.link();
    const outcome = await this.shareTarget.share({
      title: this.transloco.translate('friends.invite.title'),
      text: shareLines(
        this.transloco.translate('friends.invite.message'),
        this.transloco.translate('friends.invite.code', {
          code: this.spacedCode(),
        }),
      ),
      ...(link ? { url: link } : {}),
    });
    if (outcome === 'copied') {
      this.toasts.success(this.transloco.translate('friends.invite.copied'));
    } else if (outcome === 'failed') {
      this.toasts.failure(this.transloco.translate('share.failed'));
    }
  }

  /** Sends the request, and says what came of it. */
  protected async add(): Promise<void> {
    const outcome = await this.store.request(this.typed());
    if (!outcome.ok) {
      this.error.set(`friends.add.error.${outcome.error}`);
      return;
    }
    this.typed.set('');
    this.toasts.success(
      this.transloco.translate(
        outcome.value.status === 'accepted'
          ? 'friends.add.accepted'
          : 'friends.add.sent',
        { name: outcome.value.friend.nickname },
      ),
    );
    this.dismissed.emit();
  }
}
