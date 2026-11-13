import {
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * A button that only acts once it has been **held**.
 *
 * It is for the one action in the app that cannot be undone: deleting the
 * account. A second confirmation dialog would be easier to build, but a
 * question asked twice in a row is one people learn to click through
 * without reading, while a press that has to last cannot happen by
 * accident — a mis-touch is short by definition.
 *
 * Holding is reported by the fill sweeping across the button, so the
 * player can see both that something is happening and that letting go
 * stops it. How it is worked is said under it, in the colour of the action
 * itself, because a control that answers an unusual gesture has to say so. Everything works from a keyboard too: Space or Enter held down
 * is the same gesture, because a control that only answers a finger
 * answers nobody using a keyboard or a switch.
 *
 * The colours come from the caller through `--wq-hold-*`, as this library
 * holds no opinion about which action is destructive.
 */
@Component({
  selector: 'wq-hold-button',
  template: `
    <button
      type="button"
      class="hold"
      data-testid="hold-button"
      [class.holding]="holding()"
      [disabled]="disabled()"
      [attr.aria-describedby]="hintId"
      (pointerdown)="begin($event)"
      (pointerup)="letGo()"
      (pointerleave)="letGo()"
      (pointercancel)="letGo()"
      (keydown)="onKeyDown($event)"
      (keyup)="letGo()"
      (blur)="letGo()"
    >
      <span
        class="fill"
        aria-hidden="true"
        [style.transition-duration.ms]="holding() ? duration() : RELEASE_MS"
      ></span>
      <span class="label"><ng-content /></span>
    </button>
    <!-- Under the button rather than inside it: two lines of text turned
         the button into a block half a screen tall on a phone. It keeps
         the colour of the action it explains, so it reads as part of the
         same thing, and the button points at it as its description. -->
    <p [id]="hintId" class="hint">{{ hint() }}</p>
  `,
  styleUrl: './hold-button.scss',
})
export class HoldButton {
  /** How long the button has to be held, in milliseconds. */
  readonly duration = input(1600);
  readonly disabled = input(false);
  /** Said under the button, and read out as its description. */
  readonly hint = input.required<string>();
  /** The hold went all the way through. */
  readonly held = output<void>();

  protected readonly RELEASE_MS = 160;
  protected readonly holding = signal(false);
  protected readonly hintId = `wq-hold-hint-${++holdCount}`;

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  protected begin(event: Event): void {
    if (this.disabled() || this.holding()) {
      return;
    }
    // Keeps the press from turning into a scroll or a text selection
    // halfway through, which would cancel it for no reason the player can
    // see.
    event.preventDefault();
    (event.target as HTMLElement).focus();
    this.holding.set(true);
    this.timer = setTimeout(() => {
      this.holding.set(false);
      this.timer = null;
      this.held.emit();
    }, this.duration());
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key !== ' ' && event.key !== 'Enter') {
      return;
    }
    // A held key repeats; only the first one starts the hold, and Space
    // would otherwise scroll the page underneath.
    event.preventDefault();
    if (!event.repeat) {
      this.begin(event);
    }
  }

  protected letGo(): void {
    this.stopTimer();
    this.holding.set(false);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** Unique ids, so two of these never share one description. */
let holdCount = 0;
