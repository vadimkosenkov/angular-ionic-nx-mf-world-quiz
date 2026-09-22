import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '@world-quiz/client/auth';
import { ProgressStore } from '@world-quiz/client/progress';

/**
 * Whether the player may use the app: signed in, or — when the API could not
 * be reached at start-up — the owner of the data on this device, so a player
 * who signed in before can keep playing offline (ADR-011).
 */
async function mayPlay(): Promise<boolean> {
  const auth = inject(AuthStore);
  const progress = inject(ProgressStore);
  await Promise.all([auth.whenRestored(), progress.load()]);

  const user = auth.user();
  if (auth.status() === 'signed-in' && user) {
    // Another account's data is deleted before anything is shown.
    await progress.claim(user);
    return true;
  }
  return auth.status() === 'unverified' && progress.owner() !== null;
}

/** Tabs and quizzes: only for a player who may play; others sign in first. */
export const signedInGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await mayPlay()) || router.parseUrl('/welcome');
};

/** The welcome screen: a player who may already play goes straight home. */
export const signedOutGuard: CanActivateFn = async () => {
  const router = inject(Router);
  return (await mayPlay()) ? router.parseUrl('/home') : true;
};
