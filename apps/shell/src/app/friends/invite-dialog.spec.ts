import {
  HttpTestingController,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { AuthStore } from '@world-quiz/client/auth';
import { APP_URL } from '@world-quiz/client/quiz-ports';
import {
  SHARE_TARGET,
  type ShareOutcome,
  type SharePayload,
  Toasts,
} from '@world-quiz/client/ui';
import type { AuthResponse } from '@world-quiz/shared/contracts';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { InviteDialog } from './invite-dialog';

const settle = () => new Promise((resolve) => setTimeout(resolve));

const SESSION: AuthResponse = {
  user: {
    id: '1f0e6b8f-0000-4000-8000-000000000001',
    displayName: 'Ann',
    nickname: 'Ann the Explorer',
    email: 'ann@example.com',
    providers: ['google'],
    inviteCode: 'ANN12345',
    createdAt: '2026-09-21T10:00:00.000Z',
  },
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-09-21T10:15:00.000Z',
};

const FRIEND = {
  id: '2f0e6b8f-0000-4000-8000-000000000002',
  nickname: 'Boris',
  since: '2026-11-18T10:00:00.000Z',
};

async function renderDialog({ appUrl = 'https://play.example.test' } = {}) {
  const shared: SharePayload[] = [];
  const dismissed: true[] = [];
  let outcome: ShareOutcome = 'shared';
  const view = await render(InviteDialog, {
    on: { dismissed: () => dismissed.push(true) },
    providers: [
      ...provideShellTesting(),
      { provide: APP_URL, useValue: appUrl },
      {
        provide: SHARE_TARGET,
        useValue: {
          share: (payload: SharePayload) => {
            shared.push(payload);
            return Promise.resolve(outcome);
          },
          canShare: () => false,
        },
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

  const restoring = TestBed.inject(AuthStore).restore();
  await answer('POST', '/v1/auth/refresh', (request) => request.flush(SESSION));
  await restoring;
  await answer('GET', '/v1/friends', (request) =>
    request.flush({ friends: [], incoming: [], outgoing: [] }),
  );

  /** Types a code into the field and presses Add. */
  const add = async (code: string) => {
    const field = screen.getByTestId('friend-code') as HTMLInputElement;
    fireEvent.input(field, { target: { value: code } });
    view.fixture.detectChanges();
    fireEvent.click(screen.getByTestId('friend-add'));
    await settle();
    view.fixture.detectChanges();
  };

  return {
    ...view,
    http,
    answer,
    add,
    shared,
    dismissed,
    shareWillBe: (next: ShareOutcome) => {
      outcome = next;
    },
    toasts: TestBed.inject(Toasts),
  };
}

describe('InviteDialog', () => {
  it('shows the code in two halves and a QR of the link that opens it', async () => {
    await renderDialog();

    // Eight characters in a row are hard to read off a screen.
    expect(screen.getByTestId('invite-code').textContent?.trim()).toBe(
      'ANN1 2345',
    );
    const qr = screen.getByTestId('invite-qr');
    expect(qr.querySelector('svg')?.getAttribute('role')).toBe('img');
    expect(screen.getByLabelText('A QR code of your invite link')).toBeTruthy();
  });

  it('hands the sheet the invite, with the address of this deployment', async () => {
    const { shared } = await renderDialog();

    fireEvent.click(screen.getByTestId('invite-share'));
    await settle();

    expect(shared).toEqual([
      {
        title: 'Invite a friend',
        text: 'Play World Quiz with me.\nMy code: ANN1 2345',
        url: 'https://play.example.test/invite/ANN12345',
      },
    ]);
  });

  it('says the invite is copied where there is no sheet', async () => {
    const { shareWillBe, toasts } = await renderDialog();
    shareWillBe('copied');

    fireEvent.click(screen.getByTestId('invite-share'));
    await settle();

    expect(toasts.current()?.text).toBe('The invite is copied.');
  });

  it('has no link, and no QR, in a build that was not told where it lives', async () => {
    // The iPhone bundle's own origin is no use to anybody else; the code
    // itself is then the whole invite.
    await renderDialog({ appUrl: '' });

    expect(screen.queryByTestId('invite-qr')).toBeNull();
    expect(screen.getByTestId('invite-code').textContent?.trim()).toBe(
      'ANN1 2345',
    );
  });

  it('explains a code it will not send, beside the field', async () => {
    const { add, http } = await renderDialog();
    await add('nope');

    expect(screen.getByTestId('friend-code-error').textContent).toContain(
      'A code is eight characters',
    );
    expect(
      screen.getByTestId('friend-code').getAttribute('aria-describedby'),
    ).toBe('friend-code-error');
    expect(
      http.match({
        method: 'POST',
        url: `${TEST_API_URL}/v1/friends/requests`,
      }),
    ).toEqual([]);
  });

  it('says whose code it is when the player types their own', async () => {
    const { add } = await renderDialog();
    await add('ANN12345');

    expect(screen.getByTestId('friend-code-error').textContent).toContain(
      'That code is yours',
    );
  });

  it('closes itself once the request is on its way, and says what happened', async () => {
    const { add, answer, dismissed, toasts } = await renderDialog();
    await add('B0B12345');
    await answer('POST', '/v1/friends/requests', (request) =>
      request.flush({ status: 'requested', friend: FRIEND }),
    );
    await answer('GET', '/v1/friends', (request) =>
      request.flush({ friends: [], incoming: [], outgoing: [FRIEND] }),
    );

    expect(toasts.current()?.text).toBe('Asked Boris to be friends.');
    expect(dismissed).toEqual([true]);
  });

  it('keeps the dialog open when nobody holds the code', async () => {
    const { add, answer, dismissed } = await renderDialog();
    await add('B0B12345');
    await answer('POST', '/v1/friends/requests', (request) =>
      request.flush(null, { status: 404, statusText: 'Not Found' }),
    );

    expect(screen.getByTestId('friend-code-error').textContent).toContain(
      'Nobody holds that code',
    );
    expect(dismissed).toEqual([]);
  });
});
