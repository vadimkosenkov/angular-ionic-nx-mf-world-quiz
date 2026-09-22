import { RenderMode, type ServerRoute } from '@angular/ssr';
import { SITE_LANGUAGES } from './i18n/site-language';

const eachLanguage = async () => SITE_LANGUAGES.map((lang) => ({ lang }));

/**
 * How each page is rendered:
 * - home and legal pages are **prerendered** at build time, once per
 *   language — they change only with a new release;
 * - the leaderboard is **rendered on the server** for every request, from
 *   the API's current data.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: eachLanguage,
  },
  {
    path: ':lang/privacy',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: eachLanguage,
  },
  {
    path: ':lang/terms',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: eachLanguage,
  },
  { path: '**', renderMode: RenderMode.Server },
];
