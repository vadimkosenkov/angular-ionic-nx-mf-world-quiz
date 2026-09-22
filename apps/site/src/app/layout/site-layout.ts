import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { SiteI18n } from '../i18n/site-i18n';
import {
  isSiteLanguage,
  SITE_LANGUAGES,
  type SiteLanguage,
} from '../i18n/site-language';
import { SITE_CONFIG } from '../site-config';

/**
 * The frame of every page under `/<lang>/`: header, navigation, language
 * switch and footer. It sets the language for the whole site from the URL,
 * `<html lang>`, and the canonical and `hreflang` links search engines use to
 * pair the English and Russian versions of a page.
 */
@Component({
  selector: 'wq-site-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './site-layout.html',
  styleUrl: './site-layout.scss',
})
export class SiteLayout {
  private readonly i18n = inject(SiteI18n);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  protected readonly config = inject(SITE_CONFIG);

  /** The `:lang` route parameter (validated by the route's `canMatch`). */
  readonly lang = input.required<string>();

  protected readonly language = computed<SiteLanguage>(() => {
    const lang = this.lang();
    return isSiteLanguage(lang) ? lang : 'en';
  });
  protected readonly text = this.i18n.text;
  protected readonly otherLanguage = computed(
    () => SITE_LANGUAGES.find((lang) => lang !== this.language()) ?? 'en',
  );

  /** The page's path without its language, e.g. `/leaderboard/flags-hard`. */
  private readonly path = signal('');
  protected readonly otherLanguageLink = computed(
    () => `/${this.otherLanguage()}${this.path()}`,
  );

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects.split(/[?#]/)[0] ?? '';
        this.path.set(url.replace(/^\/[a-z]{2}(?=\/|$)/, ''));
      }
    });

    effect(() => {
      const language = this.language();
      this.i18n.language.set(language);
      this.document.documentElement.lang = language;
      this.updateLinks(this.path());
    });
  }

  private updateLinks(path: string): void {
    const head = this.document.head;
    head
      .querySelectorAll('link[data-wq-alternate]')
      .forEach((link) => link.remove());
    const add = (rel: string, lang: SiteLanguage | null, target: string) => {
      const link = this.document.createElement('link');
      link.setAttribute('rel', rel);
      if (lang) link.setAttribute('hreflang', lang);
      link.setAttribute('href', `${this.config.siteUrl}/${target}${path}`);
      link.setAttribute('data-wq-alternate', '');
      head.appendChild(link);
    };
    add('canonical', null, this.language());
    for (const lang of SITE_LANGUAGES) add('alternate', lang, lang);
  }
}
