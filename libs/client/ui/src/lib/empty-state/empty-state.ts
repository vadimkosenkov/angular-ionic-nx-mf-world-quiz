import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';

/**
 * Friendly placeholder for "nothing here yet", "unavailable" or "offline".
 * Actions (buttons, links) are projected as content.
 */
@Component({
  selector: 'wq-empty-state',
  imports: [IonIcon],
  template: `
    <div class="icon" aria-hidden="true">
      <ion-icon [name]="icon()" />
    </div>
    <h2 class="heading">{{ heading() }}</h2>
    @if (message()) {
      <p class="message">{{ message() }}</p>
    }
    <ng-content />
  `,
  styleUrl: './empty-state.scss',
  host: { role: 'status' },
})
export class EmptyState {
  /** An icon registered with `addIcons`, e.g. `trophy-outline`. */
  readonly icon = input.required<string>();
  readonly heading = input.required<string>();
  readonly message = input<string>('');
}
