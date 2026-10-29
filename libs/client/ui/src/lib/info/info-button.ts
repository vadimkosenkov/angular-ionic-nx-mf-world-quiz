import { Component, input, signal } from '@angular/core';
import { IonContent, IonIcon, IonPopover } from '@ionic/angular';

/**
 * The "i" beside a setting, and the note it opens.
 *
 * A note under a group of settings has two problems: several of them run
 * together into one paragraph, and the reader has to work out which control
 * each one is about. Here the note belongs to its row, hidden until it is
 * asked for, so the list stays a list of settings.
 *
 * The popover is anchored to the click (`event`), which is how a popover
 * points at the thing it explains on iOS; dismissing it is Ionic's own
 * backdrop. The button is a real `<button>` with a label, because an icon
 * on its own says nothing to a screen reader.
 */
@Component({
  selector: 'wq-info-button',
  imports: [IonIcon, IonPopover, IonContent],
  template: `
    <button
      type="button"
      class="info"
      data-testid="info-button"
      [attr.aria-label]="label()"
      (click)="present($event)"
    >
      <ion-icon name="information-circle-outline" aria-hidden="true" />
    </button>
    <!-- Ionic marks the popover aria-modal but gives it no role, which axe
         reports as an ARIA attribute the element may not carry. It is a
         dialog, so it says so here — and then it can be named as well. -->
    <ion-popover
      role="dialog"
      [attr.aria-label]="label()"
      [isOpen]="open()"
      [event]="anchor()"
      (didDismiss)="open.set(false)"
    >
      <ng-template>
        <ion-content class="ion-padding">
          <p class="note" data-testid="info-note">{{ text() }}</p>
        </ion-content>
      </ng-template>
    </ion-popover>
  `,
  styleUrl: './info-button.scss',
})
export class InfoButton {
  /** The note itself (this library has no texts). */
  readonly text = input.required<string>();
  /** Translated name of the button, e.g. "About sounds". */
  readonly label = input.required<string>();

  protected readonly open = signal(false);
  /** The click the popover points at; Ionic reads it when it opens. */
  protected readonly anchor = signal<Event | undefined>(undefined);

  protected present(event: Event): void {
    this.anchor.set(event);
    this.open.set(true);
  }
}
