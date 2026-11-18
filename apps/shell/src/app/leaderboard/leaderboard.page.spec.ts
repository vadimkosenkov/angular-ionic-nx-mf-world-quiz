import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import { signal } from '@angular/core';
import { SyncService } from '@world-quiz/client/progress';
import {
  SHARE_TARGET,
  type SharePayload,
  type ShareOutcome,
  Toasts,
} from '@world-quiz/client/ui';
import { APP_URL } from '@world-quiz/client/quiz-ports';
import type { Leaderboard, MyRecords } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { LastSetupStore } from '../core/last-setup.store';
import { LeaderboardPage } from './leaderboard.page';

const settle = () => new Promise((resolve) => setTimeout(resolve));

/** The board the page opens on: Capitals, the whole world, Easy, quick round. */
const DEFAULT_BOARD = 'capitals-easy-world-fixed';

const BOARD: Leaderboard = {
  board: DEFAULT_BOARD,
  players: 3,
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
      nickname: 'Ann the Explorer',
      score: 247_300,
      timeMs: 247_300,
      recordedAt: '2026-09-22T10:05:00.000Z',
    },
  ],
};

const RECORDS: MyRecords = {
  records: [
    {
      board: DEFAULT_BOARD,
      nickname: 'Ann the Explorer',
      rank: 2,
      players: 3,
      score: 247_300,
      timeMs: 247_300,
      recordedAt: '2026-09-22T10:05:00.000Z',
    },
    {
      board: 'flags-hard-europe-timed',
      nickname: 'Ann the Explorer',
      rank: 5,
      players: 40,
      score: 12,
      timeMs: 55_000,
      recordedAt: '2026-09-22T11:00:00.000Z',
    },
  ],
};

async function renderPage({
  board = BOARD as Leaderboard | 'error',
  records = RECORDS as MyRecords | 'error',
} = {}) {
  const roots: { url: string; extras: unknown }[] = [];
  const lastSyncedAt = signal<number | null>(null);
  const shared: SharePayload[] = [];
  let shareOutcome: ShareOutcome = 'shared';
  const view = await render(LeaderboardPage, {
    providers: [
      ...provideShellTesting(),
      { provide: SyncService, useValue: { lastSyncedAt } },
      { provide: APP_URL, useValue: 'https://play.example.test' },
      {
        provide: SHARE_TARGET,
        useValue: {
          share: (payload: SharePayload) => {
            shared.push(payload);
            return Promise.resolve(shareOutcome);
          },
        },
      },
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

  await answer('/v1/me/records', (request) =>
    records === 'error' ? failWith(request) : request.flush(records),
  );

  /** Presses "Show the board" and answers the request it makes. */
  const openBoard = async (id = DEFAULT_BOARD) => {
    fireEvent.click(screen.getByTestId('board-show'));
    view.fixture.detectChanges();
    await answer(`/v1/leaderboards/${id}`, (request) =>
      board === 'error' ? failWith(request) : request.flush(board),
    );
  };

  return {
    ...view,
    http,
    answer,
    openBoard,
    roots,
    lastSyncedAt,
    shared,
    shareWillBe: (outcome: ShareOutcome) => {
      shareOutcome = outcome;
    },
    toasts: TestBed.inject(Toasts),
  };
}

/** The ranking's own rows; the board picker is a list of options too. */
const entryRows = () =>
  within(screen.getByTestId('leaderboard-entries')).getAllByRole('listitem');

const emit = (testId: string, value: unknown) =>
  screen
    .getByTestId(testId)
    .dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));

describe('LeaderboardPage', () => {
  it('says what a board asks of a player, in their own words', async () => {
    await renderPage();

    // What a board asks for is on the mode itself: the numbers in the table
    // mean nothing without it, and it changes with the mode.
    expect(screen.getByTestId('board-mode-fixed').textContent).toContain(
      'Answer 10 random questions correctly, faster than anyone else.',
    );
    expect(screen.getByTestId('board-mode-timed').textContent).toContain(
      'Answer as many questions correctly as you can in 60 seconds.',
    );
    // Nothing is asked of the API until the player asks for a board.
    expect(screen.queryByTestId('leaderboard-ranking')).toBeNull();
  });

  it('opens the board named by the four choices, with the player marked', async () => {
    const { openBoard } = await renderPage();
    await openBoard();

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Capitals · World');
    expect(dialog.textContent).toContain('Easy · Quick round');
    const rows = entryRows();
    expect(
      rows.map((row) => row.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['1 Speedy 3:05.4', '2 Ann the Explorer (you) 4:07.3']);
    expect(rows[1]?.getAttribute('aria-current')).toBe('true');
    expect(screen.getByTestId('leaderboard-ranking').textContent).toContain(
      '3 players ranked',
    );
  });

  it('shows the board the four choices describe', async () => {
    const { answer, fixture } = await renderPage();

    fireEvent.click(screen.getByTestId('board-category-flags'));
    fireEvent.click(screen.getByTestId('board-difficulty-hard'));
    fireEvent.click(screen.getByTestId('board-scope-europe'));
    fireEvent.click(screen.getByTestId('board-mode-timed'));
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId('board-show'));
    fixture.detectChanges();
    await answer('/v1/leaderboards/flags-hard-europe-timed', (request) =>
      request.flush({
        board: 'flags-hard-europe-timed',
        players: 1,
        entries: [
          {
            rank: 1,
            nickname: 'Speedy',
            score: 21,
            timeMs: 58_200,
            recordedAt: '2026-09-22T10:00:00.000Z',
          },
        ],
      }),
    );

    // The four settings as two deliberate lines, under the trophy.
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('Flags · Europe');
    expect(dialog.textContent).toContain('Hard · Time attack');
    // A Time attack board counts answers; the time is the tie-break beside it.
    const row = entryRows()[0];
    expect(row?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '1 Speedy 21 correct 0:58.2',
    );
    // And the screen opens on this board next time: answering the same four
    // questions before every look is work the app can do once.
    expect(TestBed.inject(LastSetupStore).board()).toEqual({
      category: 'flags',
      scope: 'europe',
      difficulty: 'hard',
      mode: 'timed',
    });
  });

  it('closes the board and asks for it again when it is opened afresh', async () => {
    const { openBoard, fixture } = await renderPage();
    await openBoard();

    fireEvent.click(screen.getByTestId('dialog-close'));
    fixture.detectChanges();
    expect(screen.queryByRole('dialog')).toBeNull();

    // Looking again is a new look: a run finished since may have reached it.
    await openBoard();
    expect(entryRows()).toHaveLength(2);
  });

  it("pins the player's own row under a page that does not reach their place", async () => {
    const { openBoard } = await renderPage({
      board: { ...BOARD, entries: [BOARD.entries[0] as never] },
    });
    await openBoard();

    expect(
      screen
        .getByTestId('leaderboard-my-row')
        .textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('2 Ann the Explorer (you) 4:07.3');
  });

  it('says so, and offers to retry, when the board cannot be loaded', async () => {
    const { openBoard, answer } = await renderPage({ board: 'error' });
    await openBoard();

    expect(screen.getByTestId('leaderboard-error').textContent).toContain(
      'cannot be loaded',
    );
    fireEvent.click(screen.getByText('Try again'));
    await answer(`/v1/leaderboards/${DEFAULT_BOARD}`, (request) =>
      request.flush(BOARD),
    );
    expect(entryRows()).toHaveLength(2);
  });

  it("lists the player's records, one row per board they rank on", async () => {
    const { fixture } = await renderPage();

    emit('leaderboard-view', 'mine');
    fixture.detectChanges();

    expect(
      screen
        .getByTestId(`record-${DEFAULT_BOARD}`)
        .textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Capitals · World · Easy · Quick round 4:07.3 #2 of 3');
    expect(
      screen
        .getByTestId('record-flags-hard-europe-timed')
        .textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('Flags · Europe · Hard · Time attack 12 correct #5 of 40');
  });

  it('invites a first flawless run when there are no records', async () => {
    const { fixture } = await renderPage({ records: { records: [] } });

    emit('leaderboard-view', 'mine');
    fixture.detectChanges();

    expect(screen.getByTestId('leaderboard-no-records').textContent).toContain(
      'No records yet',
    );
  });

  it('shares a record as the board, the score and the place', async () => {
    const { fixture, shared } = await renderPage();

    emit('leaderboard-view', 'mine');
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId(`share-record-${DEFAULT_BOARD}`));
    await settle();

    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({
      title: 'World Quiz',
      // The claim the picture leads with opens the message too; a record
      // looked up here is not news, so it claims the place.
      text: "I'm in the top three!\n4:07.3 · #2 of 3\nCapitals · World · Easy · Quick round",
      url: 'https://play.example.test',
    });
    // The picture travels with it where the device takes files; its words
    // are tested in `record-share-card.spec.ts`.
    expect(shared[0]?.image).toBeTypeOf('function');
  });

  it('says so when the record was copied rather than shared', async () => {
    const { fixture, shareWillBe, toasts } = await renderPage();
    shareWillBe('copied');

    emit('leaderboard-view', 'mine');
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId(`share-record-${DEFAULT_BOARD}`));
    await settle();

    expect(toasts.current()).toMatchObject({ tone: 'success' });
  });

  it('only accepts a known view from the segment event', async () => {
    const { fixture } = await renderPage();
    const page = fixture.componentInstance as unknown as {
      view: () => string;
    };

    emit('leaderboard-view', 'mine');
    emit('leaderboard-view', 'friends');
    fixture.detectChanges();

    expect(page.view()).toBe('mine');
  });

  it('loads the board again after a sync, so a run just recorded appears', async () => {
    const { answer, openBoard, lastSyncedAt, fixture } = await renderPage({
      board: { board: DEFAULT_BOARD, players: 0, entries: [] },
      records: { records: [] },
    });
    await openBoard();
    expect(screen.getByTestId('leaderboard-empty')).toBeTruthy();

    lastSyncedAt.set(1);
    fixture.detectChanges();
    await answer(`/v1/leaderboards/${DEFAULT_BOARD}`, (request) =>
      request.flush(BOARD),
    );
    await answer('/v1/me/records', (request) => request.flush(RECORDS));

    expect(
      screen.getByRole('listitem', { current: true }).textContent,
    ).toContain('Ann the Explorer');
  });
});
