import { Router } from 'express';
import { REFRESH_COOKIE, refreshCookieOptions } from '../http/cookies';
import { sendProblem } from '../http/problem';
import type { AuthService } from './auth-service';
import { currentUserId } from './require-auth';

/**
 * `/v1/me` — the signed-in user. Mounted behind `requireAuth`.
 *
 * `DELETE /v1/me` deletes the account and everything it owns (App Store
 * Review Guideline 5.1.1(v) requires in-app account deletion).
 */
export function meRouter(
  auth: AuthService,
  { secureCookies }: { secureCookies: boolean },
): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    const user = await auth.currentUser(currentUserId(response));
    if (!user) {
      sendProblem(response, {
        status: 401,
        title: 'Unauthorized',
        detail: 'This account no longer exists.',
      });
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.json(user);
  });

  router.delete('/', async (_request, response) => {
    await auth.deleteAccount(currentUserId(response));
    response.clearCookie(REFRESH_COOKIE, refreshCookieOptions(secureCookies));
    response.status(204).end();
  });

  return router;
}
