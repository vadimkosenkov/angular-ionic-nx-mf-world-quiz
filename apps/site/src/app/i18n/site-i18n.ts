import { computed, Injectable, signal } from '@angular/core';
import { en, type SiteText } from './en';
import { ru } from './ru';
import type { SiteLanguage } from './site-language';

const TEXTS: Record<SiteLanguage, SiteText> = { en, ru };

/**
 * The site's language and its texts. Set from the URL (`/en/…`, `/ru/…`) by
 * the layout; templates read typed texts (`text().home.heading`), so a
 * missing translation is a compile error rather than a key on the page.
 */
@Injectable({ providedIn: 'root' })
export class SiteI18n {
  readonly language = signal<SiteLanguage>('en');
  readonly text = computed(() => TEXTS[this.language()]);
}
