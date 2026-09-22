import { updateProfileRequestSchema } from '@world-quiz/shared/contracts';
import { Router } from 'express';
import { REFRESH_COOKIE, refreshCookieOptions } from '../http/cookies';
import { sendProblem, validationErrors } from '../http/problem';
import type { LeaderboardService } from '../leaderboard/leaderboard-service';
import type { AuthService } from './auth-service';
import { currentUserId } from './require-auth';

/**
 * `/v1/me` — the signed-in user. Mounted behind `requireAuth`.
 *
 * `PATCH /v1/me` changes the public nickname; `GET /v1/me/records` lists the
 * player's best ranked runs. `DELETE /v1/me` deletes the account and
 * everything it owns (App Store Review Guideline 5.1.1(v) requires in-app
 * account deletion).
 */
export function meRouter(
  auth: AuthService,
  leaderboard: LeaderboardService,
  { secureCookies }: { secureCookies: boolean },
): Router {
  const router = Router();

  const accountGone = (response: Parameters<typeof sendProblem>[0]) =>
    sendProblem(response, {
      status: 401,
      title: 'Unauthorized',
      detail: 'This account no longer exists.',
    });

  router.get('/', async (_request, response) => {
    const user = await auth.currentUser(currentUserId(response));
    if (!user) {
      accountGone(response);
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.json(user);
  });

  router.patch('/', async (request, response) => {
    const parsed = updateProfileRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendProblem(response, {
        status: 400,
        title: 'Invalid profile',
        detail:
          'A nickname has 3 to 24 letters, digits, spaces, "_", "-" or ".", and starts and ends with a letter or digit.',
        errors: validationErrors(parsed.error),
      });
      return;
    }
    const user = await auth.setNickname(
      currentUserId(response),
      parsed.data.nickname,
    );
    if (!user) {
      accountGone(response);
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    response.json(user);
  });

  router.get('/records', async (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.json(await leaderboard.records(currentUserId(response)));
  });

  router.delete('/', async (_request, response) => {
    await auth.deleteAccount(currentUserId(response));
    response.clearCookie(REFRESH_COOKIE, refreshCookieOptions(secureCookies));
    response.status(204).end();
  });

  return router;
}
