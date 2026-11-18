import { httpResource } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  RESPONSE_INIT,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { leaderboardSchema } from '@world-quiz/shared/contracts';
import {
  DIFFICULTIES,
  formatRunTime,
  leaderboardBoardById,
  leaderboardBoardFor,
  type LeaderboardBoardId,
  QUIZ_CATEGORIES,
  QUIZ_SCOPES,
  RANKED_MODES,
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
 *
 * There are 56 boards (docs/domain/leaderboard.md), so they are not a list of
 * links: the picker is four groups of links, one per setting, and each link
 * changes that one setting of the board being shown. Every board is a real
 * URL a search engine can reach, and the page needs no JavaScript to switch.
 */
@Component({
  selector: 'wq-leaderboard-page',
  imports: [RouterLink],
  templateUrl: './leaderboard.page.html',
  styleUrl: './leaderboard.page.scss',
})
export class LeaderboardPage {
  private readonly config = inject(SITE_CONFIG);
  private readonly response = inject(RESPONSE_INIT, { optional: true });
  protected readonly i18n = inject(SiteI18n);
  protected readonly text = this.i18n.text;
  protected readonly formatRunTime = formatRunTime;

  /** The `:board` route parameter, validated by the route's `canMatch`. */
  readonly board = input.required<LeaderboardBoardId>();

  protected readonly current = computed(() =>
    leaderboardBoardById(this.board()),
  );

  /** What this board ranks by: a time, or a number of answers. */
  protected readonly metric = computed(() => this.current().metric);

  /** The board's name, the four settings it stands for. */
  protected readonly boardName = computed(() => {
    const t = this.text().leaderboard;
    const board = this.current();
    return [
      t.category[board.category],
      t.scope[board.scope],
      t.difficulty[board.difficulty],
      t.mode[board.mode],
    ].join(' · ');
  });

  /** The picker: one group of links per setting of the board. */
  protected readonly groups = computed(() => {
    const t = this.text().leaderboard;
    const { category, difficulty, scope, mode } = this.current();
    return [
      {
        label: t.pick.category,
        options: QUIZ_CATEGORIES.map((value) => ({
          name: t.category[value],
          board: leaderboardBoardFor(value, difficulty, scope, mode).id,
          active: value === category,
        })),
      },
      {
        label: t.pick.scope,
        options: QUIZ_SCOPES.map((value) => ({
          name: t.scope[value],
          board: leaderboardBoardFor(category, difficulty, value, mode).id,
          active: value === scope,
        })),
      },
      {
        label: t.pick.difficulty,
        options: DIFFICULTIES.map((value) => ({
          name: t.difficulty[value],
          board: leaderboardBoardFor(category, value, scope, mode).id,
          active: value === difficulty,
        })),
      },
      {
        label: t.pick.mode,
        options: RANKED_MODES.map((value) => ({
          name: t.mode[value],
          board: leaderboardBoardFor(category, difficulty, scope, value).id,
          active: value === mode,
        })),
      },
    ];
  });

  protected readonly ranking = httpResource(
    () => `${this.config.apiUrl}/v1/leaderboards/${this.board()}`,
    { parse: (body) => leaderboardSchema.parse(body) },
  );

  protected readonly title = computed(
    () => `${this.boardName()} · ${this.text().leaderboard.title} · World Quiz`,
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
