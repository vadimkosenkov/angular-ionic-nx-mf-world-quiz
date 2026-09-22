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
import { SiteI18n } from '../i18n/site-i18n';
import { DEFAULT_SITE_CONFIG } from '../site-config';
import { LeaderboardPage } from './leaderboard.page';

const BOARD: Leaderboard = {
  board: 'flags-hard',
  players: 2,
  entries: [
    {
      rank: 1,
      nickname: 'Speedy',
      completionTimeMs: 185_400,
      recordedAt: '2026-09-22T10:00:00.000Z',
    },
    {
      rank: 2,
      nickname: 'Globe Trotter',
      completionTimeMs: 247_300,
      recordedAt: '2026-09-22T10:05:00.000Z',
    },
  ],
};

async function renderBoard(
  respond: (http: HttpTestingController) => void,
  language: 'en' | 'ru' = 'en',
) {
  const response: ResponseInit = {};
  const view = await render(LeaderboardPage, {
    inputs: { board: 'flags-hard' },
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

const url = `${DEFAULT_SITE_CONFIG.apiUrl}/v1/leaderboards/flags-hard`;

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
    expect(screen.getByTestId('site-ranking').textContent).toContain(
      '2 players ranked',
    );
    expect(response.headers).toEqual({
      'Cache-Control': 'public, max-age=30',
    });
  });

  it('speaks Russian on /ru', async () => {
    await renderBoard((http) => http.expectOne(url).flush(BOARD), 'ru');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Рейтинг',
    );
    expect(screen.getByTestId('site-ranking').textContent).toContain(
      'В рейтинге 2 игрока',
    );
  });

  it('invites the first player on an empty board', async () => {
    await renderBoard((http) =>
      http
        .expectOne(url)
        .flush({ board: 'flags-hard', players: 0, entries: [] }),
    );

    expect(screen.getByTestId('site-ranking-empty').textContent).toContain(
      'Be the first',
    );
  });

  it('answers 503, uncached, when the API cannot be reached', async () => {
    const { response } = await renderBoard((http) =>
      http.expectOne(url).error(new ProgressEvent('error')),
    );

    expect(screen.getByTestId('site-ranking-unavailable')).toBeTruthy();
    expect(response.status).toBe(503);
    expect(response.headers).toEqual({ 'Cache-Control': 'no-store' });
  });
});
