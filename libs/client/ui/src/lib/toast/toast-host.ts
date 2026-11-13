import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { Toasts } from './toasts';

/**
 * Shows the message `Toasts` is holding. The app renders one of these,
 * outside the router outlet, so a message survives the navigation that
 * follows the action it reports (signing out, for one).
 *
 * Like `wq-dialog`, the host element moves to `document.body` after the
 * first render: Ionic contains `ion-app` (`contain: layout`), which makes it
 * a stacking context of its own, so no `z-index` written inside it can put a
 * message over a dialog that has already left for the body. A failure the
 * player can neither read nor put away is worse than no message at all.
 *
 * `@for` over a list of at most one message is deliberate: it gives every
 * message its own element, and an element **inserted** with `role="alert"` is
 * what screen readers announce. Changing the text inside an element that was
 * already there is announced by some and missed by others.
 *
 * `role` by tone, because the two are not equally urgent: a failure
 * interrupts (`alert`), a confirmation waits its turn (`status`).
 */
@Component({
  selector: 'wq-toast-host',
  imports: [IonIcon],
  template: `
    @for (toast of showing(); track toast.id) {
      <div
        class="toast"
        [class.error]="toast.tone === 'error'"
        [attr.role]="toast.tone === 'error' ? 'alert' : 'status'"
        data-testid="toast"
      >
        <ion-icon
          [name]="toast.tone === 'error' ? 'alert-circle' : 'checkmark-circle'"
          aria-hidden="true"
        />
        <p class="text">{{ toast.text }}</p>
        <!-- A message can sit over the very control the player wants next,
             and it is on a timer, so there is a way to put it away now. -->
        <button
          type="button"
          class="dismiss"
          data-testid="toast-dismiss"
          [attr.aria-label]="dismissLabel()"
          (click)="toasts.dismiss()"
        >
          <ion-icon name="close" aria-hidden="true" />
        </button>
      </div>
    }
  `,
  styleUrl: './toast-host.scss',
})
export class ToastHost {
  /** Translated label of the close button (this library has no texts). */
  readonly dismissLabel = input.required<string>();

  protected readonly toasts = inject(Toasts);
  protected readonly showing = computed(() => {
    const toast = this.toasts.current();
    return toast ? [toast] : [];
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const document = inject(DOCUMENT);
    afterNextRender(() => document.body.appendChild(host));
    // The host usually lives as long as the app does; a test that tears one
    // down would otherwise leave it in the body of the next one.
    inject(DestroyRef).onDestroy(() => host.remove());
  }
}
