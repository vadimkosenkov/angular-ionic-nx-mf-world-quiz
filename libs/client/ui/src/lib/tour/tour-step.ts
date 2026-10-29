import { Component, computed, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/**
 * One step of a guided tour: the card that says what the player is looking
 * at and moves on to the next thing.
 *
 * A tour is for a screen whose point is easy to miss — the quiz setup, where
 * everything is already chosen and Start is one tap away. The page blurs
 * every part except the one this step is about; this card carries the words
 * and the only way forward, so it sits at the bottom, where the page's next
 * action always is.
 *
 * It is not a message (design-system.md): nobody did anything to cause it.
 * The text is announced as it changes (`aria-live="polite"`) because the
 * card stays and only its contents move on.
 */
@Component({
  selector: 'wq-tour-step',
  imports: [IonIcon],
  template: `
    <div class="card" data-testid="tour-step">
      <ion-icon name="bulb-outline" aria-hidden="true" />
      <p class="text" aria-live="polite" data-testid="tour-text">
        {{ text() }}
      </p>
      <!-- A picture of how far along the tour is: the image role lets the
           dots carry the label that says it in words (a bare div may not). -->
      <div class="dots" role="img" [attr.aria-label]="progressLabel()">
        @for (dot of dots(); track dot) {
          <span
            class="dot"
            [class.on]="dot <= step()"
            aria-hidden="true"
          ></span>
        }
      </div>
      <button
        type="button"
        class="next"
        data-testid="tour-next"
        (click)="advanced.emit()"
      >
        {{ last() ? lastLabel() : nextLabel() }}
      </button>
    </div>
  `,
  styleUrl: './tour-step.scss',
})
export class TourStep {
  /** What this step explains (this library has no translations). */
  readonly text = input.required<string>();
  /** 1-based step number. */
  readonly step = input.required<number>();
  readonly total = input.required<number>();
  /** Translated "Step 2 of 4", for the dots a screen reader cannot read. */
  readonly progressLabel = input.required<string>();
  readonly nextLabel = input.required<string>();
  /** The label of the last step's button ("Got it"). */
  readonly lastLabel = input.required<string>();

  readonly advanced = output<void>();

  protected readonly last = computed(() => this.step() >= this.total());
  protected readonly dots = computed(() =>
    Array.from({ length: this.total() }, (_, index) => index + 1),
  );
}
