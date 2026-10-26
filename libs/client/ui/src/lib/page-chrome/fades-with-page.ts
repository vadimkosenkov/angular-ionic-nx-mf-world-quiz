import { Directive, inject } from '@angular/core';
import { PageChromeState } from './page-chrome-state';

/**
 * Hides a floating element while its page is being left.
 *
 * The chrome that floats over a page — the header's pill and back button, the
 * action bar — stays on screen for as long as Ionic keeps the page alive,
 * which is the length of the transition. The arriving page is underneath by
 * then, so the title being left sits on top of the title arriving. Ionic's own
 * toolbar never shows this because its iOS transition fades the title and the
 * back button by name; a custom header is not on that list.
 *
 * The page it belongs to provides `PageChromeState` and sets it from
 * `ionViewWillLeave` / `ionViewWillEnter`. Without that provider the directive
 * does nothing, which is right for a page that cannot be left by a back
 * gesture.
 */
@Directive({
  selector: '[wqFadesWithPage]',
  host: { '[class.wq-leaving]': 'leaving()' },
})
export class FadesWithPage {
  private readonly state = inject(PageChromeState, { optional: true });

  protected leaving(): boolean {
    return this.state?.leaving() ?? false;
  }
}
