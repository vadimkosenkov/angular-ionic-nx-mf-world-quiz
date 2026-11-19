import { HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { render } from '@testing-library/angular';
import { AuthStore } from '@world-quiz/client/auth';
import { KEY_VALUE_STORAGE } from '@world-quiz/client/settings';
import { provideShellTesting, TEST_API_URL } from '../../testing/shell-testing';
import { PENDING_INVITE_STORAGE_KEY } from './friends.store';
import { InvitePage } from './invite.page';

const settle = () => new Promise((resolve) => setTimeout(resolve));

/**
 * Where the page sends the player is decided by who they turn out to be
 * once the sign-in has been restored, and nothing else — so the sign-in is
 * a stub here, held back until the page has had to wait for it.
 */
function authThatRestoresTo(signedIn: boolean) {
  let restored = () => undefined as void;
  const whenRestored = new Promise<void>((resolve) => {
    restored = () => resolve();
  });
  return {
    restore: restored,
    provider: {
      provide: AuthStore,
      useValue: {
        whenRestored: () => whenRestored,
        signedIn: signal(signedIn),
        user: signal(undefined),
        // What `authInterceptor` asks of the store on the way out.
        currentAccessToken: () => 'access-1',
        refreshAccessToken: () => Promise.resolve(null),
      } as unknown as AuthStore,
    },
  };
}

async function land(signedIn: boolean) {
  const roots: string[] = [];
  const auth = authThatRestoresTo(signedIn);
  const view = await render(InvitePage, {
    inputs: { code: 'B0B12345' },
    providers: [
      ...provideShellTesting(),
      auth.provider,
      {
        provide: NavController,
        useValue: { navigateRoot: (url: string) => roots.push(url) },
      },
    ],
  });
  const storage = TestBed.inject(KEY_VALUE_STORAGE);

  // Nothing is decided while the sign-in is still being restored, but the
  // code is already written down: signing in takes a round trip to Google,
  // and this page does not outlive it.
  await settle();
  const stored = () => storage.get(PENDING_INVITE_STORAGE_KEY);

  auth.restore();
  await settle();
  view.fixture.detectChanges();
  return {
    ...view,
    roots,
    stored,
    http: TestBed.inject(HttpTestingController),
  };
}

describe('InvitePage', () => {
  it('writes the code down and sends a stranger to sign in first', async () => {
    const { roots, stored, http } = await land(false);

    // An invite is usually sent to somebody who has no account yet: the
    // code waits on the device until there is somebody to send it from.
    expect(await stored()).toBe('B0B12345');
    expect(roots).toEqual(['/welcome']);
    http.match(() => true);
  });

  it('sends a player who is already signed in to their friends', async () => {
    const { roots, stored, http } = await land(true);

    expect(roots).toEqual(['/friends']);
    // Writing the code down is what sends it when there is already an
    // account, and it is forgotten whatever came of it.
    expect(
      http.match({
        method: 'POST',
        url: `${TEST_API_URL}/v1/friends/requests`,
      }),
    ).toHaveLength(1);
    expect(await stored()).toBeNull();
    http.match(() => true);
  });
});
