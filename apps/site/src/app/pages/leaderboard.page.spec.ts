import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import type { Leaderboard } from '@world-quiz/shared/contracts';
import type { LeaderboardBoardId } from '@world-quiz/quiz/domain';
import { SiteI18n } from '../i18n/site-i18n';
import { DEFAULT_SITE_CONFIG } from '../site-config';
import { LeaderboardPage } from './leaderboard.page';

const BOARD_ID: LeaderboardBoardId = 'flags-hard-europe-fixed';

const BOARD: Leaderboard = {
  board: BOARD_ID,
  players: 2,
  entries: [
    {
      rank: 1,
      nickname: 'Speedy',
      score: 185_400,
      timeMs: 185_400,
      recordedAt: '2026-09-22T10:00:00.000Z',
    },
    {
      rank: 2,
      nickname: 'Globe Trotter',
      score: 247_300,
      timeMs: 247_300,
      recordedAt: '2026-09-22T10:05:00.000Z',
    },
  ],
};

/** The same two players on a board where more answers is better. */
const TIMED_BOARD: Leaderboard = {
  board: 'flags-hard-europe-timed',
  players: 2,
  entries: [
    {
      rank: 1,
      nickname: 'Speedy',
      score: 21,
      timeMs: 58_200,
      recordedAt: '2026-09-22T10:00:00.000Z',
    },
  ],
};

async function renderBoard(
  respond: (http: HttpTestingController) => void,
  language: 'en' | 'ru' = 'en',
  board: LeaderboardBoardId = BOARD_ID,
) {
  const response: ResponseInit = {};
  const view = await render(LeaderboardPage, {
    inputs: { board },
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: RESPONSE_INIT, useValue: response },
    ],
    configureTestBed: () => TestBed.inject(SiteI18n).language.set(language),
  });
  const http = TestBed.inject(HttpTestingController);
  await new Promise((resolve) => setTimeout(resolve));
  respond(http);
  await new Promise((resolve) => setTimeout(resolve));
  view.fixture.detectChanges();
  return { ...view, response };
}

const urlOf = (board: LeaderboardBoardId) =>
  `${DEFAULT_SITE_CONFIG.apiUrl}/v1/leaderboards/${board}`;
const url = urlOf(BOARD_ID);

describe('LeaderboardPage (site)', () => {
  it('renders the ranking as a table, cacheable for 30 seconds', async () => {
    const { response } = await renderBoard((http) =>
      http.expectOne(url).flush(BOARD),
    );

    const rows = screen
      .getAllByRole('row')
      .map((row) =>
        [...row.querySelectorAll('th, td')].map((cell) =>
          cell.textContent?.trim(),
        ),
      );
    expect(rows).toEqual([
      ['Rank', 'Player', 'Time'],
      ['1', 'Speedy', '3:05.4'],
      ['2', 'Globe Trotter', '4:07.3'],
    ]);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain(
      'Flags · Europe · Hard · Quick round',
    );
    expect(screen.getByTestId('site-ranking').textContent).toContain(
      '2 players ranked',
    );
    // The content type is part of the set: assigning `headers` replaces
    // everything Angular would have sent, including it.
    expect(response.headers).toEqual({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=30',
    });
  });

  it('speaks Russian on /ru', async () => {
    await renderBoard((http) => http.expectOne(url).flush(BOARD), 'ru');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Рейтинги',
    );
    expect(screen.getByTestId('site-ranking').textContent).toContain(
      'В рейтинге 2 игрока',
    );
  });

  it('invites the first player on an empty board', async () => {
    await renderBoard((http) =>
      http.expectOne(url).flush({ board: BOARD_ID, players: 0, entries: [] }),
    );

    expect(screen.getByTestId('site-ranking-empty').textContent).toContain(
      'Be the first',
    );
  });

  it('shows the answers reached, and the time beside them, on a Time attack board', async () => {
    await renderBoard(
      (http) => http.expectOne(urlOf(TIMED_BOARD.board)).flush(TIMED_BOARD),
      'en',
      TIMED_BOARD.board,
    );

    const rows = screen
      .getAllByRole('row')
      .map((row) =>
        [...row.querySelectorAll('th, td')].map((cell) =>
          cell.textContent?.trim(),
        ),
      );
    expect(rows).toEqual([
      ['Rank', 'Player', 'Correct', 'Time'],
      ['1', 'Speedy', '21', '0:58.2'],
    ]);
  });

  it('offers every other board as a link, one setting at a time', async () => {
    await renderBoard((http) => http.expectOne(url).flush(BOARD));

    // 2 categories + 7 regions + 2 difficulties + 2 modes.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(13);
    const current = screen.getAllByRole('link', { current: 'page' });
    expect(current.map((link) => link.textContent?.trim())).toEqual([
      'Flags',
      'Europe',
      'Hard',
      'Quick round',
    ]);
    expect(
      links
        .map((link) => link.getAttribute('href'))
        .filter((href) => href?.endsWith('capitals-hard-europe-fixed')),
    ).toHaveLength(1);
  });

  it('answers 503, uncached, when the API cannot be reached', async () => {
    const { response } = await renderBoard((http) =>
      http.expectOne(url).error(new ProgressEvent('error')),
    );

    expect(screen.getByTestId('site-ranking-unavailable')).toBeTruthy();
    expect(response.status).toBe(503);
    expect(response.headers).toEqual({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
  });
});
