import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  provideRouter,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { NavController } from '@ionic/angular';
import { AuthStore, type AuthStatus } from '@world-quiz/client/auth';
import {
  createMemoryLocalStore,
  LOCAL_STORE,
  ProgressStore,
} from '@world-quiz/client/progress';
import { ANN, BOB, finishedSession } from '@world-quiz/client/progress/testing';
import { signedInGuard, signedOutGuard } from './sign-in.guards';
import { provideSignInFlow } from './sign-in.providers';

function setup(status: AuthStatus, user = ANN) {
  const authStatus = signal<AuthStatus>(status);
  const roots: string[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: LOCAL_STORE, useValue: createMemoryLocalStore() },
      {
        provide: AuthStore,
        useValue: {
          status: authStatus,
          user: signal(user),
          whenRestored: () => Promise.resolve(),
        },
      },
      {
        provide: NavController,
        useValue: { navigateRoot: (url: string) => roots.push(url) },
      },
      provideSignInFlow(),
    ],
  });
  const run = (guard: typeof signedInGuard) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;
  return {
    authStatus,
    roots,
    progress: TestBed.inject(ProgressStore),
    inside: () => run(signedInGuard),
    welcome: () => run(signedOutGuard),
  };
}

const target = (result: boolean | UrlTree) =>
  result instanceof UrlTree ? result.toString() : result;

describe('sign-in guards', () => {
  it('let a signed-in player in and send them past the welcome screen', async () => {
    const { inside, welcome } = setup('signed-in');

    expect(target(await inside())).toBe(true);
    expect(target(await welcome())).toBe('/home');
  });

  it('send a signed-out visitor to the welcome screen', async () => {
    const { inside, welcome } = setup('signed-out');

    expect(target(await inside())).toBe('/welcome');
    expect(target(await welcome())).toBe(true);
  });

  it("delete another account's data before a new player gets in", async () => {
    const { inside, progress } = setup('signed-in', BOB);
    await progress.claim(ANN);
    progress.recordSession(finishedSession([{ code: 'fr', correct: false }]));

    await inside();

    expect(progress.owner()).toEqual(BOB);
    expect(progress.mistakeCount()).toBe(0);
  });

  it('let a known player play offline, but not a stranger', async () => {
    const offline = setup('unverified');
    expect(target(await offline.inside())).toBe('/welcome');

    await offline.progress.claim(ANN);
    expect(target(await offline.inside())).toBe(true);
  });
});

describe('provideSignInFlow', () => {
  it('returns to the welcome screen when a sign-in ends, not when there was none', () => {
    const { authStatus, roots } = setup('restoring');
    TestBed.tick();
    authStatus.set('signed-out');
    TestBed.tick();
    expect(roots).toEqual([]);

    authStatus.set('signed-in');
    TestBed.tick();
    authStatus.set('signed-out');
    TestBed.tick();

    expect(roots).toEqual(['/welcome']);
  });
});
