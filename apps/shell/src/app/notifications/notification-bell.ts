import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, IonIcon, IonPopover, NavController } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { NotificationsStore } from '../core/notifications.store';

/**
 * The bell in the corner of Home: what the app has to say to the player,
 * as opposed to what just happened because of something they did (that is a
 * toast, design-system.md).
 *
 * It is a list and not a single sentence on purpose. Today the only message
 * is a release the player has not read about; a friend's challenge is the
 * next thing to belong here, and a bell that can only ever say one thing
 * would have to be rebuilt for it. An empty list says so in words rather
 * than hiding the bell: a control that comes and goes is one the player
 * cannot learn.
 *
 * Pressing a message opens the page it is about and dismisses the popover.
 * The mark is cleared by that page, not by this press (notifications.store.ts).
 */
@Component({
  selector: 'wq-notification-bell',
  imports: [IonContent, IonIcon, IonPopover, TranslocoPipe],
  template: `
    <button
      type="button"
      class="wq-header-action"
      data-testid="notifications"
      [attr.aria-label]="label() | transloco"
      (click)="present($event)"
    >
      <ion-icon name="notifications-outline" aria-hidden="true" />
      @if (store.unread()) {
        <span class="dot" data-testid="notifications-dot" aria-hidden="true">
        </span>
      }
    </button>
    <!-- Ionic marks the popover aria-modal but gives it no role, which axe
         reports as an attribute the element may not carry; it is a dialog,
         so it says so, and can then be named. -->
    <!-- The list hangs from whatever element the press landed on, which is
         why nothing inside the button takes presses of its own
         (notification-bell.scss): anchored to the icon the card sat a few
         pixels to one side, and anchored to the mark it opened over the
         bell. The gap below the button is the popover's offset. -->
    <ion-popover
      role="dialog"
      class="notifications"
      [attr.aria-label]="'notifications.title' | transloco"
      [isOpen]="open()"
      [event]="anchor()"
      (didDismiss)="open.set(false)"
    >
      <ng-template>
        <ion-content class="ion-padding">
          @if (notifications().length === 0) {
            <p class="empty" data-testid="notifications-empty">
              {{ 'notifications.empty' | transloco }}
            </p>
          }
          @for (notification of notifications(); track notification.version) {
            <button
              type="button"
              class="message"
              data-testid="notification-release"
              (click)="openReleaseNotes()"
            >
              <ion-icon name="sparkles-outline" aria-hidden="true" />
              <span class="words">
                <span class="name">
                  {{
                    'notifications.release.title'
                      | transloco: { version: notification.version }
                  }}
                </span>
                <span class="note">
                  {{ 'notifications.release.action' | transloco }}
                </span>
              </span>
              <ion-icon name="chevron-forward" aria-hidden="true" />
            </button>
          }
        </ion-content>
      </ng-template>
    </ion-popover>
  `,
  styleUrl: './notification-bell.scss',
})
export class NotificationBell {
  private readonly nav = inject(NavController);

  protected readonly store = inject(NotificationsStore);
  protected readonly notifications = this.store.notifications;
  protected readonly open = signal(false);
  /** The press the popover points at; Ionic reads it when it opens. */
  protected readonly anchor = signal<Event | undefined>(undefined);

  /** A screen reader is told whether there is anything to read. */
  protected readonly label = computed(() =>
    this.store.unread() ? 'notifications.labelUnread' : 'notifications.label',
  );

  protected present(event: Event): void {
    this.anchor.set(event);
    this.open.set(true);
  }

  protected async openReleaseNotes(): Promise<void> {
    this.open.set(false);
    await this.nav.navigateForward('/release-notes');
  }
}
