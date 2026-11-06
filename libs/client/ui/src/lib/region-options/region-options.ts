import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

/** One region to choose from, with its name already in the right language. */
export interface RegionOption {
  /** The domain's `QuizScope`, which is also the sketch to show. */
  readonly scope: string;
  readonly name: string;
  /** How many countries the region holds. */
  readonly count: number;
  /**
   * The whole button's accessible name, e.g. "Europe, 44 countries" — the
   * bare "(44)" beside the name tells a screen reader nothing.
   */
  readonly label: string;
}

/**
 * The grid of regions, used wherever a screen asks which part of the world
 * it is about: the quiz setup and the countries reference. Both showed the
 * same list of names before this existed, and only one of them grew the
 * sketches.
 *
 * The texts arrive translated, because `client/ui` holds no translations.
 */
@Component({
  selector: 'wq-region-options',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="wq-options grid" [attr.data-testid]="testId()">
      @for (option of options(); track option.scope) {
        <li>
          <button
            type="button"
            class="wq-option sketched"
            [class.selected]="selected() === option.scope"
            [attr.aria-pressed]="selected() === option.scope"
            [attr.data-testid]="testId() + '-' + option.scope"
            [attr.aria-label]="option.label"
            (click)="chosen.emit(option.scope)"
          >
            <!-- The sketch says which part of the world this is faster than
                 its name does, and it is decoration for anyone who cannot
                 see it: the button is already named by its aria-label. -->
            <span
              class="wq-option-sketch"
              aria-hidden="true"
              [attr.data-region]="option.scope"
            ></span>
            <span>
              {{ option.name }}
              <span class="wq-option-count" aria-hidden="true"
                >({{ option.count }})</span
              >
            </span>
          </button>
        </li>
      }
    </ul>
  `,
})
export class RegionOptions {
  readonly options = input.required<readonly RegionOption[]>();
  /** The scope currently chosen, as the host's own state. */
  readonly selected = input.required<string>();
  /** Prefix for the test ids: the list gets it, each button it plus its scope. */
  readonly testId = input.required<string>();
  readonly chosen = output<string>();
}
