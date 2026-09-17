import { Component, input } from '@angular/core';
import { ProgressBar } from '../progress-bar/progress-bar';

/**
 * Summary card with a big "value / max", a progress bar and a caption row.
 * `glass` is used for the one hero summary per screen; lists stay solid.
 */
@Component({
  selector: 'wq-progress-card',
  imports: [ProgressBar],
  template: `
    <div class="header">
      <h2 class="heading">{{ heading() }}</h2>
      <p class="value" aria-hidden="true">
        {{ value() }}<span class="max"> / {{ max() }}</span>
      </p>
    </div>
    <wq-progress-bar
      [value]="value()"
      [max]="max()"
      [label]="heading()"
      [valueText]="valueText()"
    />
    <div class="footer">
      <span>{{ caption() }}</span>
      <span>{{ detail() }}</span>
    </div>
  `,
  styleUrl: './progress-card.scss',
  host: {
    '[class.wq-glass]': "variant() === 'glass'",
    '[class.solid]': "variant() === 'solid'",
  },
})
export class ProgressCard {
  readonly heading = input.required<string>();
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  /** Translated accessible value, e.g. "0 of 195". */
  readonly valueText = input.required<string>();
  readonly caption = input<string>('');
  readonly detail = input<string>('');
  readonly variant = input<'glass' | 'solid'>('solid');
}
