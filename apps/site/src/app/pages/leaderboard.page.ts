import { httpResource } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  RESPONSE_INIT,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { leaderboardSchema } from '@world-quiz/shared/contracts';
import {
  formatRunTime,
  LEADERBOARD_BOARDS,
  type LeaderboardBoardId,
} from '@world-quiz/quiz/domain';
import { SiteI18n } from '../i18n/site-i18n';
import { PageMeta } from '../page-meta';
import { SITE_CONFIG } from '../site-config';

/**
 * The public leaderboard of one board, rendered on the server for every
 * request from the API's current data (`GET /v1/leaderboards/:board`), so
 * search engines and visitors without JavaScript see the real ranking. The
 * response reaches the browser in the page (transfer cache): hydration does
 * not ask the API again. Pages may be cached for 30 seconds.
 */
@Component({
  selector: 'wq-leaderboard-page',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './leaderboard.page.html',
  styleUrl: './leaderboard.page.scss',
})
export class LeaderboardPage {
  private readonly config = inject(SITE_CONFIG);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  protected readonly i18n = inject(SiteI18n);
  protected readonly text = this.i18n.text;
  protected readonly boards = LEADERBOARD_BOARDS;
  protected readonly formatRunTime = formatRunTime;

  /** The `:board` route parameter, validated by the route's `canMatch`. */
  readonly board = input.required<LeaderboardBoardId>();

  protected readonly ranking = httpResource(
    () => `${this.config.apiUrl}/v1/leaderboards/${this.board()}`,
    { parse: (body) => leaderboardSchema.parse(body) },
  );

  protected readonly title = computed(
    () =>
      `${this.text().leaderboard.boards[this.board()]} · ${this.text().leaderboard.title} · World Quiz`,
  );

  constructor() {
    const meta = inject(PageMeta);
    effect(() => meta.set(this.title(), this.text().leaderboard.description));

    // Shared caches may keep a ranking briefly; an unreachable API is a 503,
    // so neither caches nor search engines keep the error page.
    effect(() => {
      if (!this.response) return;
      // Assigning `headers` replaces the whole set, so the content type has
      // to be repeated here: without it the browser does not know it is
      // looking at a page and offers the HTML as a download.
      const contentType = 'text/html; charset=utf-8';
      if (this.ranking.error()) {
        this.response.status = 503;
        this.response.headers = {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        };
      } else {
        this.response.headers = {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=30',
        };
      }
    });
  }
}
