import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';

/** How loudly the dialog speaks: a plain task, or something destructive. */
export type DialogTone = 'neutral' | 'danger';

/** What stays between the foot of a dialog and the top of the keyboard. */
const KEYBOARD_GAP = 16;

/** Unique ids, so two dialogs on one screen do not name each other's title. */
let dialogCount = 0;

/**
 * One small task over the screen: a dimmed backdrop and a card in the middle
 * of it.
 *
 * It is centred rather than pinned to the foot, which a sheet on a phone
 * usually is, for two reasons. On a wide screen a card at the bottom reads
 * as something that slid off the page; and on iOS the on-screen keyboard is
 * invisible to CSS (the layout viewport does not shrink, see
 * design-system.md), so a field held against the bottom edge is the first
 * thing the keyboard covers. In the middle it stays in sight.
 *
 * It is built here rather than with `ion-modal` because Ionic's overlays do
 * not upgrade in jsdom, and what these dialogs are for — what they save and
 * what they refuse — is worth testing without a browser
 * (docs/testing/strategy.md).
 *
 * The content is projected, so the caller owns the words and the actions;
 * this component owns the backdrop, the frame, the title and the ways out.
 * `closeLabel` is what draws the round close button: a dialog that offers a
 * cancel of its own does not pass one, or the same way out is on the screen
 * twice.
 */
@Component({
  selector: 'wq-dialog',
  imports: [IonIcon],
  template: `
    <!-- Tapping beside the card closes it, which is what a thumb tries
         first. It is hidden from screen readers and skipped by the tab key:
         the way out they are offered is a control, not a rectangle. -->
    <button
      type="button"
      class="backdrop"
      tabindex="-1"
      aria-hidden="true"
      data-testid="dialog-backdrop"
      (click)="dismissed.emit()"
    ></button>
    <div
      #card
      class="dialog"
      tabindex="-1"
      aria-modal="true"
      [class.danger]="tone() === 'danger'"
      [attr.role]="tone() === 'danger' ? 'alertdialog' : 'dialog'"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="describedBy() || null"
      [style.transform]="'translateY(' + keyboardShift() + 'px)'"
      (keydown.escape)="dismissed.emit()"
      (keydown.tab)="keepFocusInside($event)"
    >
      <div class="head">
        <p class="title" [id]="titleId">{{ title() }}</p>
        @if (closeLabel(); as label) {
          <button
            type="button"
            class="close"
            data-testid="dialog-close"
            [attr.aria-label]="label"
            (click)="dismissed.emit()"
          >
            <ion-icon name="close" aria-hidden="true" />
          </button>
        }
      </div>
      <ng-content />
    </div>
  `,
  styleUrl: './dialog.scss',
})
export class Dialog {
  /** The dialog's own name, read first by a screen reader. */
  readonly title = input.required<string>();
  /** The id of the projected paragraph that explains it, if there is one. */
  readonly describedBy = input<string>('');
  readonly tone = input<DialogTone>('neutral');
  /** The round close button's name; without one the button is not drawn. */
  readonly closeLabel = input<string>('');
  /** The backdrop, the close button and Escape all mean the same thing. */
  readonly dismissed = output<void>();

  /**
   * How far the card has to move to stay in the middle of what can be seen.
   *
   * The on-screen keyboard is invisible to CSS on iOS: the layout viewport
   * keeps its size, and the system scrolls the document instead, which
   * leaves a `position: fixed` card drifting upwards out of the middle of
   * the room that is left. Only `visualViewport` knows about any of it, so
   * the card is re-centred against that, with a transition, so the move
   * reads as the dialog making room rather than as a jump.
   */
  protected readonly keyboardShift = signal(0);

  private readonly document = inject(DOCUMENT);
  private readonly destroyed = inject(DestroyRef);
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  /** What had the focus before, so it can have it back. */
  private readonly opener = this.document.activeElement;

  protected readonly titleId = `wq-dialog-title-${++dialogCount}`;

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement;
    afterNextRender(() => {
      // Out of the page and onto the document, because Ionic's router
      // outlet is its own stacking context **below** the floating tab bar:
      // no z-index written inside a page can put anything over that bar, so
      // a dialog left in the page leaves the tabs lit and clickable behind
      // its own backdrop. Angular keeps the component and its bindings;
      // only the element moves, and the node is removed from wherever it
      // then is. It moves after the first render, not in the constructor —
      // moved before Angular has filled it, the host stays empty.
      this.document.body.appendChild(host);
      // The card itself takes the focus rather than the first field: a
      // screen reader then reads the dialog's name before whatever is in
      // it, and on iOS focusing a field by script opens no keyboard anyway
      // (the player has to tap it, see design-system.md).
      this.card().nativeElement.focus();
      // After the card exists: the measurement reads its height.
      this.followTheVisibleArea();
    });
    // Closing puts the focus back where it came from — the row that opened
    // the dialog — rather than at the top of the page.
    this.destroyed.onDestroy(() => {
      // The host was moved out of the view that owns it, so it is taken
      // away by hand: a page destroyed with a dialog open would otherwise
      // leave it standing over whatever comes next.
      host.remove();
      const opener = this.opener;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
      }
    });
  }

  /** Re-centres the card whenever the keyboard, or a scroll, moves it. */
  private followTheVisibleArea(): void {
    const view = this.document.defaultView;
    const viewport = view?.visualViewport;
    if (!view || !viewport) {
      return;
    }
    const measure = () => {
      // iOS lifts the page itself to reveal the field; undoing that lift is
      // what keeps the card standing still on the screen.
      const lifted = this.document.scrollingElement?.scrollTop ?? 0;
      const screen = view.innerHeight;
      const covered = Math.max(
        0,
        screen - viewport.height - viewport.offsetTop,
      );
      // Where the card's foot is when it is simply in the middle, and how
      // much of it the keyboard would take. The card is nudged up by that
      // much and no more: re-centring it in the room that is left threw it
      // halfway up the screen the moment the keyboard appeared.
      const foot = (screen + this.card().nativeElement.offsetHeight) / 2;
      const nudge = Math.max(0, foot + KEYBOARD_GAP - (screen - covered));
      this.keyboardShift.set(Math.round(lifted - nudge));
    };
    measure();
    viewport.addEventListener('resize', measure);
    viewport.addEventListener('scroll', measure);
    this.destroyed.onDestroy(() => {
      viewport.removeEventListener('resize', measure);
      viewport.removeEventListener('scroll', measure);
    });
  }

  /**
   * Tab stays inside while the dialog is open. Without this the next tab
   * leaves for the page underneath, which is still there and still
   * clickable to a keyboard.
   */
  protected keepFocusInside(event: Event): void {
    const key = event as KeyboardEvent;
    const stops = [
      ...this.card().nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), ion-button:not([disabled]), ion-input, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const first = stops[0];
    const last = stops.at(-1);
    if (!first || !last) {
      key.preventDefault();
      return;
    }
    const active = this.document.activeElement;
    if (
      key.shiftKey &&
      (active === first || active === this.card().nativeElement)
    ) {
      key.preventDefault();
      last.focus();
    } else if (!key.shiftKey && active === last) {
      key.preventDefault();
      first.focus();
    }
  }
}
