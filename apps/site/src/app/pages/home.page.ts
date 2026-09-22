import { Component, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteI18n } from '../i18n/site-i18n';
import { PageMeta } from '../page-meta';
import { SITE_CONFIG } from '../site-config';

/** What World Quiz is, and where to go next. Prerendered in each language. */
@Component({
  selector: 'wq-home-page',
  imports: [RouterLink],
  template: `
    @let t = text().home;
    <section class="hero">
      <h1>{{ t.heading }}</h1>
      <p class="tagline wq-text-secondary">{{ t.tagline }}</p>
      <div class="actions">
        <a class="wq-button" [href]="config.appUrl">{{ t.play }}</a>
        <a
          class="wq-button secondary"
          [routerLink]="['/', i18n.language(), 'leaderboard']"
          >{{ t.leaderboard }}</a
        >
      </div>
    </section>
    <ul class="points wq-card">
      @for (point of t.points; track point) {
        <li>{{ point }}</li>
      }
    </ul>
  `,
  styles: `
    .hero {
      padding: var(--wq-space-6) 0;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: clamp(2.25rem, 6vw, 3.5rem);
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .tagline {
      margin: var(--wq-space-2) 0 var(--wq-space-6);
      font-size: 1.25rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--wq-space-3);
    }
    .points {
      display: grid;
      gap: var(--wq-space-3);
      margin: 0;
      padding-left: var(--wq-space-8);
    }
  `,
})
export class HomePage {
  protected readonly i18n = inject(SiteI18n);
  protected readonly text = this.i18n.text;
  protected readonly config = inject(SITE_CONFIG);

  constructor() {
    const meta = inject(PageMeta);
    effect(() =>
      meta.set(this.text().home.title, this.text().home.description),
    );
  }
}
