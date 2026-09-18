import { Component, computed, input } from '@angular/core';

export type ProgressTone = 'primary' | 'success' | 'warning';

/**
 * Accessible progress bar. Screen readers get the numbers through
 * `aria-valuenow/min/max` and a caller-provided, already translated
 * `aria-valuetext` (e.g. "3 of 44").
 */
@Component({
  selector: 'wq-progress-bar',
  template: `
    <div
      class="track"
      role="progressbar"
      [attr.aria-label]="label()"
      aria-valuemin="0"
      [attr.aria-valuemax]="safeMax()"
      [attr.aria-valuenow]="clampedValue()"
      [attr.aria-valuetext]="valueText() || null"
    >
      <div class="fill" [class]="tone()" [style.width.%]="percent()"></div>
    </div>
  `,
  styleUrl: './progress-bar.scss',
})
export class ProgressBar {
  readonly value = input.required<number>();
  readonly max = input.required<number>();
  readonly label = input.required<string>();
  readonly valueText = input<string>('');
  readonly tone = input<ProgressTone>('primary');

  protected readonly safeMax = computed(() => Math.max(0, this.max()));
  protected readonly clampedValue = computed(() =>
    Math.min(Math.max(0, this.value()), this.safeMax()),
  );
  /** 0–100, rounded to one decimal. An empty scale (max 0) shows 0%. */
  readonly percent = computed(() =>
    this.safeMax() === 0
      ? 0
      : Math.round((this.clampedValue() / this.safeMax()) * 1000) / 10,
  );
}
