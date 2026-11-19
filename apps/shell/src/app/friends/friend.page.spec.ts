import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import { Toasts } from '@world-quiz/client/ui';
import type { FriendProfile } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { FriendPage } from './friend.page';

const settle = () => new Promise((resolve) => setTimeout(resolve));

const ID = '2f0e6b8f-0000-4000-8000-000000000002';

const PROFILE: FriendProfile = {
  friend: {
    id: ID,
    nickname: 'Boris',
    since: '2026-11-10T10:00:00.000Z',
  },
  records: [
    {
      board: 'capitals-easy-world-fixed',
      nickname: 'Boris',
      rank: 1,
      players: 12,
      score: 185_400,
      timeMs: 185_400,
      recordedAt: '2026-11-11T10:00:00.000Z',
    },
    {
      board: 'flags-hard-europe-timed',
      nickname: 'Boris',
      rank: 7,
      players: 40,
      score: 21,
      timeMs: 60_000,
      recordedAt: '2026-11-12T10:00:00.000Z',
    },
  ],
  achievements: [
    {
      id: 'capitals-africa-mastered',
      status: 'in-progress',
      mastered: 6,
      total: 54,
    },
    {
      id: 'flags-europe-mastered',
      status: 'unlocked',
      mastered: 44,
      total: 44,
    },
    // Nothing to show: a region this build has no countries for would be a
    // row saying 0/0.
    {
      id: 'capitals-oceania-mastered',
      status: 'locked',
      mastered: 0,
      total: 0,
    },
  ],
};

async function renderPage(profile: FriendProfile | 'error' = PROFILE) {
  const back: string[] = [];
  const view = await render(FriendPage, {
    inputs: { id: ID },
    providers: [
      ...provideShellTesting(),
      {
        provide: NavController,
        useValue: { navigateBack: (url: string) => back.push(url) },
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);

  const answer = async (
    method: string,
    url: string,
    respond: (request: TestRequest) => void,
  ) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const [found] = http.match({ method, url: `${TEST_API_URL}${url}` });
      if (found) {
        respond(found);
        await settle();
        view.fixture.detectChanges();
        return;
      }
      await settle();
      view.fixture.detectChanges();
    }
    throw new Error(`${method} ${url} was not sent`);
  };

  await answer('GET', `/v1/friends/${ID}`, (request) =>
    profile === 'error'
      ? request.flush(null, { status: 404, statusText: 'Not Found' })
      : request.flush(profile),
  );

  return { ...view, answer, back, toasts: TestBed.inject(Toasts) };
}

const rowsOf = (testId: string) =>
  within(screen.getByTestId(testId))
    .getAllByRole('listitem')
    .map((row) => row.textContent?.replace(/\s+/g, ' ').trim());

describe('FriendPage', () => {
  it('says who they are and when it started', async () => {
    await renderPage();

    expect(screen.getByTestId('friend-who').textContent).toContain('Boris');
    expect(screen.getByTestId('friend-who').textContent).toContain(
      'Friends since Nov 10, 2026',
    );
  });

  it('shows a record per board, with what the score means there', async () => {
    await renderPage();

    // A quick round is ranked on time, a time attack on answers. The first
    // place carries its medal, whose number a screen reader hears as the
    // place it is ("1" on the disc, "#1" in words).
    expect(rowsOf('friend-records')).toEqual([
      'Capitals · World Easy · Quick round 1 #1 3:05.4',
      'Flags · Europe Hard · Time attack #7 21 correct',
    ]);
    expect(
      within(screen.getByTestId('friend-records')).getByText('1').className,
    ).toContain('gold');
  });

  it('puts what they have got furthest with first and leaves out empty regions', async () => {
    await renderPage();

    expect(rowsOf('friend-achievements')).toEqual([
      'Europe · Flags Unlocked 44/44',
      'Africa · Capitals 6/54',
    ]);
  });

  it('says the page is not theirs to see when the API says there is no such player', async () => {
    await renderPage('error');

    expect(screen.getByTestId('friend-gone').textContent).toContain(
      'not yours to see',
    );
    expect(screen.queryByTestId('friend-remove')).toBeNull();
  });

  it('asks before ending a friendship, then goes back to the list', async () => {
    const { fixture, answer, back, toasts } = await renderPage();

    fireEvent.click(screen.getByTestId('friend-remove'));
    fixture.detectChanges();
    expect(screen.getByTestId('remove-friend').textContent).toContain(
      'Remove Boris?',
    );

    fireEvent.click(screen.getByTestId('remove-friend-confirm'));
    await answer('DELETE', `/v1/friends/${ID}`, (request) =>
      request.flush(null),
    );

    expect(toasts.current()?.text).toBe('Boris is no longer a friend.');
    expect(back).toEqual(['/friends']);
  });

  it('keeps the page when the friendship could not be ended', async () => {
    const { fixture, answer, back, toasts } = await renderPage();

    fireEvent.click(screen.getByTestId('friend-remove'));
    fixture.detectChanges();
    fireEvent.click(screen.getByTestId('remove-friend-confirm'));
    await answer('DELETE', `/v1/friends/${ID}`, (request) =>
      request.error(new ProgressEvent('error')),
    );

    expect(toasts.current()?.text).toBe('That did not work. Try again.');
    expect(back).toEqual([]);
    expect(screen.getByTestId('friend-who')).toBeTruthy();
  });
});
