import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { fireEvent, render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';
import { SyncService } from '@world-quiz/client/progress';
import type { Leaderboard, MyRecords } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { LeaderboardPage } from './leaderboard.page';

const settle = () => new Promise((resolve) => setTimeout(resolve));

const BOARD: Leaderboard = {
  board: 'capitals-easy',
  players: 3,
  entries: [
    {
      rank: 1,
      nickname: 'Speedy',
      completionTimeMs: 185_400,
      recordedAt: '2026-09-22T10:00:00.000Z',
    },
    {
      rank: 2,
      nickname: 'Ann the Explorer',
      completionTimeMs: 247_300,
      recordedAt: '2026-09-22T10:05:00.000Z',
    },
  ],
};

const RECORDS: MyRecords = {
  records: [
    {
      board: 'capitals-easy',
      rank: 2,
      players: 3,
      completionTimeMs: 247_300,
      recordedAt: '2026-09-22T10:05:00.000Z',
    },
  ],
};

async function renderPage({
  board = BOARD as Leaderboard | 'error',
  records = RECORDS as MyRecords | 'error',
} = {}) {
  const roots: { url: string; extras: unknown }[] = [];
  const lastSyncedAt = signal<number | null>(null);
  const view = await render(LeaderboardPage, {
    providers: [
      ...provideShellTesting(),
      { provide: SyncService, useValue: { lastSyncedAt } },
      {
        provide: NavController,
        useValue: {
          navigateForward: (url: string, extras: unknown) =>
            roots.push({ url, extras }),
        },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);

  /** Answers every pending request to `url`. */
  const answer = async (url: string, respond: (r: TestRequest) => void) => {
    for (let i = 0; i < 10; i++) {
      const found = http.match(`${TEST_API_URL}${url}`);
      if (found.length > 0) {
        found.forEach(respond);
        await settle();
        view.fixture.detectChanges();
        return;
      }
      await settle();
      view.fixture.detectChanges();
    }
    throw new Error(`${url} was not requested`);
  };
  const failWith = (request: TestRequest) =>
    request.flush(null, { status: 503, statusText: 'Unavailable' });

  await answer('/v1/leaderboards/capitals-easy', (request) =>
    board === 'error' ? failWith(request) : request.flush(board),
  );
  await answer('/v1/me/records', (request) =>
    records === 'error' ? failWith(request) : request.flush(records),
  );
  return { ...view, http, answer, roots, lastSyncedAt };
}

const emit = (testId: string, value: unknown) =>
  screen
    .getByTestId(testId)
    .dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));

describe('LeaderboardPage', () => {
  it('shows the four perfect-run boards and the rules with the real country count', async () => {
    await renderPage();

    for (const board of [
      'Capitals · Easy',
      'Capitals · Hard',
      'Flags · Easy',
      'Flags · Hard',
    ]) {
      expect(screen.getByText(board)).toBeTruthy();
    }
    expect(screen.getByTestId('leaderboard-rules').textContent).toContain(
      'Answer all 195 countries correctly',
    );
  });

  it('ranks the fastest players, with times, the field size and the player marked', async () => {
    await renderPage();

    const rows = screen.getAllByRole('listitem');
    expect(
      rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['1 Speedy 3:05.4', '2 Ann the Explorer (you) 4:07.3']);
    expect(rows[1]?.getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('leaderboard-ranking').textContent).toContain(
      '3 players ranked',
    );
  });

  it('loads the board that is chosen', async () => {
    const { answer, fixture } = await renderPage();

    emit('leaderboard-board', 'flags-hard');
    fixture.detectChanges();
    await answer('/v1/leaderboards/flags-hard', (request) =>
      request.flush({ board: 'flags-hard', players: 0, entries: [] }),
    );

    expect(screen.getByTestId('leaderboard-empty').textContent).toContain(
      'No perfect runs yet',
    );
  });

  it('says so, and offers to retry, when rankings cannot be loaded', async () => {
    const { answer } = await renderPage({ board: 'error' });

    expect(screen.getByTestId('leaderboard-error').textContent).toContain(
      'cannot be loaded',
    );
    fireEvent.click(screen.getByText('Try again'));
    await answer('/v1/leaderboards/capitals-easy', (request) =>
      request.flush(BOARD),
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it("lists the player's records on every board", async () => {
    const { fixture } = await renderPage();

    emit('leaderboard-view', 'mine');
    fixture.detectChanges();

    expect(
      screen
        .getByTestId('record-capitals-easy')
        .textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Capitals · Easy 4:07.3 #2 of 3');
    expect(screen.getByTestId('record-flags-hard').textContent).toContain(
      'No perfect run yet',
    );
  });

  it("starts a challenge and opens the board's quiz with its id and seed", async () => {
    const { answer, roots, fixture } = await renderPage();

    emit('leaderboard-board', 'flags-hard');
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId('challenge-start'));
    await answer('/v1/challenges', (request) => {
      expect(request.request.body).toEqual({ board: 'flags-hard' });
      request.flush({
        id: 'b0e5c0de-0000-4000-8000-000000000001',
        board: 'flags-hard',
        seed: 'server-seed',
        issuedAt: '2026-09-22T10:00:00.000Z',
        expiresAt: '2026-09-22T13:00:00.000Z',
      });
    });

    expect(roots).toEqual([
      {
        url: '/quiz/flags',
        extras: {
          queryParams: {
            mode: 'challenge',
            difficulty: 'hard',
            scope: 'world',
            challenge: 'b0e5c0de-0000-4000-8000-000000000001',
            seed: 'server-seed',
          },
        },
      },
    ]);
  });

  it('says so when a challenge cannot be started', async () => {
    const { answer, roots } = await renderPage();

    fireEvent.click(screen.getByTestId('challenge-start'));
    await answer('/v1/challenges', (request) =>
      request.error(new ProgressEvent('error')),
    );

    expect(screen.getByTestId('challenge-start-failed').textContent).toContain(
      'could not be started',
    );
    expect(roots).toEqual([]);
  });

  it('only accepts known views and boards from segment events', async () => {
    const { fixture } = await renderPage();
    const page = fixture.componentInstance as unknown as {
      view: () => string;
      board: () => string;
    };

    emit('leaderboard-board', 'flags-hard');
    emit('leaderboard-board', 'flags-timed');
    emit('leaderboard-board', undefined);
    emit('leaderboard-view', 'mine');
    emit('leaderboard-view', 'friends');

    expect(page.view()).toBe('mine');
    expect(page.board()).toBe('flags-hard');
  });

  it('loads again after a sync, so a run just recorded appears', async () => {
    const { answer, lastSyncedAt, fixture } = await renderPage({
      board: { board: 'capitals-easy', players: 0, entries: [] },
      records: { records: [] },
    });
    expect(screen.getByTestId('leaderboard-empty')).toBeTruthy();

    lastSyncedAt.set(1);
    fixture.detectChanges();
    await answer('/v1/leaderboards/capitals-easy', (request) =>
      request.flush(BOARD),
    );
    await answer('/v1/me/records', (request) => request.flush(RECORDS));

    expect(
      screen.getByRole('listitem', { current: true }).textContent,
    ).toContain('Ann the Explorer');
  });
});
