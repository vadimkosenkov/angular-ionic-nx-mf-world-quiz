import { Component, inject, input } from '@angular/core';
import { IonIcon, NavController } from '@ionic/angular';
import { FadesWithPage } from '../page-chrome/fades-with-page';

/**
 * The top of a page: a round back button and the page's title in a glass
 * pill, floating over the content rather than sitting in a bar.
 *
 * It replaces `ion-header`/`ion-toolbar`, for two reasons. The content now
 * scrolls under it, so the screen reads as one surface with the floating tab
 * bar at the other end — the same material, the same inset. And an installed
 * app on iOS 26/27 gets the system's status-bar effect painted over its top
 * strip, which blurred everything Ionic's toolbar drew there; a floating
 * header simply starts below it, and the space above is background rather
 * than an empty bar (CLAUDE.md has the measurements).
 *
 * The host is `position: absolute`: the routed component's host *is* Ionic's
 * `.ion-page`, so the header is anchored to its own page.
 */
@Component({
  selector: 'wq-page-header',
  imports: [IonIcon],
  hostDirectives: [FadesWithPage],
  template: `
    @if (backHref(); as href) {
      <button
        type="button"
        class="back"
        data-testid="page-back"
        [attr.aria-label]="backLabel()"
        (click)="goBack(href)"
      >
        <ion-icon name="chevron-back" aria-hidden="true" />
      </button>
    }
    <h1 class="heading">{{ heading() }}</h1>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  private readonly nav = inject(NavController);

  readonly heading = input.required<string>();
  /** Where "back" leads. Without it the page shows no back button. */
  readonly backHref = input<string>('');
  /** What a screen reader announces for the back button. */
  readonly backLabel = input<string>('Back');

  protected async goBack(href: string): Promise<void> {
    // `pop()` is Ionic's way back for a router outlet: it returns to whatever
    // is under this page on the stack rather than always to one address. The
    // href is the fallback for a page opened by a deep link, where there is
    // nothing to pop.
    //
    // It does *not* stop the chrome of the leaving page from overlapping the
    // arriving one: Ionic keeps that page alive and does not move it either
    // way. `PageChromeState` is what handles that.
    if (!(await this.nav.pop())) await this.nav.navigateBack(href);
  }
}
