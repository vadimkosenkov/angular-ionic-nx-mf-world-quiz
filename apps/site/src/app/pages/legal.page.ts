import { Component, computed, effect, inject, input } from '@angular/core';
import { SiteI18n } from '../i18n/site-i18n';
import { PageMeta } from '../page-meta';
import { SITE_CONFIG } from '../site-config';

/**
 * The Privacy Policy and the Terms of Use, prerendered in each language.
 *
 * Until the operator's name and contact address are configured
 * (`SITE_CONFIG.operator`, filled in at deployment), the page says openly
 * that it is a draft rather than showing an invented contact.
 */
@Component({
  selector: 'wq-legal-page',
  template: `
    @let t = text();
    @let doc = document();
    <article class="wq-card legal" data-testid="legal">
      <h1>{{ doc.title }}</h1>
      <p class="wq-text-secondary updated">{{ t.legal.updated }}</p>
      @if (contact(); as contact) {
        <p>{{ t.legal.contact(contact.name, contact.email) }}</p>
      } @else {
        <p class="draft" role="note" data-testid="legal-draft">
          {{ t.legal.draft }}
        </p>
      }
      @for (section of doc.sections; track section.heading) {
        <section>
          <h2>{{ section.heading }}</h2>
          @for (paragraph of section.paragraphs; track paragraph) {
            <p>{{ paragraph }}</p>
          }
        </section>
      }
      @if (!contact()) {
        <p class="wq-text-secondary">{{ t.legal.contactPending }}</p>
      }
    </article>
  `,
  styles: `
    .legal {
      max-width: 72ch;
      margin: 0 auto;
    }
    h1 {
      margin: 0;
      font-size: 2rem;
    }
    h2 {
      margin: var(--wq-space-6) 0 var(--wq-space-2);
      font-size: 1.125rem;
    }
    .updated {
      margin-top: var(--wq-space-1);
      font-size: var(--wq-font-size-caption);
    }
    .draft {
      padding: var(--wq-space-3) var(--wq-space-4);
      border-radius: var(--wq-radius-sm);
      background: var(--wq-color-warning-container);
      color: var(--wq-color-text-primary);
    }
  `,
})
export class LegalPage {
  private readonly i18n = inject(SiteI18n);
  private readonly config = inject(SITE_CONFIG);
  protected readonly text = this.i18n.text;

  /** Which document: from the route's `data`. */
  readonly doc = input.required<'privacy' | 'terms'>();

  protected readonly document = computed(() => this.text()[this.doc()]);
  protected readonly contact = computed(() => {
    const { name, email } = this.config.operator;
    return name && email ? { name, email } : null;
  });

  constructor() {
    const meta = inject(PageMeta);
    effect(() =>
      meta.set(
        `${this.document().title} · World Quiz`,
        this.document().description,
      ),
    );
  }
}
