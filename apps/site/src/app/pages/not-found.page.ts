import { Component, inject, RESPONSE_INIT } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteI18n } from '../i18n/site-i18n';

/** Unknown pages and boards: a real 404 for crawlers, a way back for people. */
@Component({
  selector: 'wq-not-found-page',
  imports: [RouterLink],
  template: `
    <div class="wq-card" data-testid="not-found">
      <h1>404</h1>
      <p>{{ text().leaderboard.notFound }}</p>
      <a [routerLink]="['/', i18n.language()]">{{ text().nav.home }}</a>
    </div>
  `,
})
export class NotFoundPage {
  protected readonly i18n = inject(SiteI18n);
  protected readonly text = this.i18n.text;

  constructor() {
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) response.status = 404;
  }
}
