import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * Whether a page's floating chrome should be hidden because the page is on
 * its way out.
 *
 * A page that can be left by the back button provides this, and the
 * `wqFadesWithPage` directive on its header and action bar reads it. Nothing
 * else is needed from the page.
 *
 * It listens to Angular's router rather than Ionic's lifecycle. Two things
 * were tried first and measured in the running app: Ionic's Angular build
 * dispatches **no DOM event** for `ionViewWillLeave` (a document-level capture
 * listener for all four lifecycle events saw none during a whole navigation),
 * and it never called `ionViewWillLeave` on the page component either — the
 * component's constructor logged, the hook did not. A navigation that starts
 * while this page exists is the page leaving, which is exactly the moment its
 * chrome has to get out of the way; the instance dies with the page, so there
 * is no stale state to reset.
 */
@Injectable()
export class PageChromeState {
  readonly leaving = signal(false);

  constructor() {
    const subscription = inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.leaving.set(true);
      } else if (
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        // The page is staying after all.
        this.leaving.set(false);
      }
    });

    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }
}
