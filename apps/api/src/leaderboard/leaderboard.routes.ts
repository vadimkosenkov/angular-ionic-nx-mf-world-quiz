import {
  leaderboardBoardIdSchema,
  leaderboardQuerySchema,
  startChallengeRequestSchema,
} from '@world-quiz/shared/contracts';
import { Router } from 'express';
import { currentUserId } from '../auth/require-auth';
import { sendProblem, validationErrors } from '../http/problem';
import type { LeaderboardService } from './leaderboard-service';

/**
 * `/v1/challenges` — starting a perfect-run challenge. Mounted behind
 * `requireAuth`: a challenge belongs to the player who started it.
 */
export function challengesRouter(leaderboard: LeaderboardService): Router {
  const router = Router();

  router.post('/', async (request, response) => {
    const parsed = startChallengeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendProblem(response, {
        status: 400,
        title: 'Invalid challenge request',
        errors: validationErrors(parsed.error),
      });
      return;
    }
    const challenge = await leaderboard.startChallenge(
      currentUserId(response),
      parsed.data.board,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.status(201).json(challenge);
  });

  return router;
}

/**
 * `/v1/leaderboards/:board` — public: the rankings are shown to everyone,
 * signed in or not, including by the SSR site. Only nicknames identify
 * players.
 */
export function leaderboardsRouter(leaderboard: LeaderboardService): Router {
  const router = Router();

  router.get('/:board', async (request, response) => {
    const board = leaderboardBoardIdSchema.safeParse(request.params.board);
    if (!board.success) {
      sendProblem(response, {
        status: 404,
        title: 'Not Found',
        detail: 'No such leaderboard.',
      });
      return;
    }
    const query = leaderboardQuerySchema.safeParse(request.query);
    if (!query.success) {
      sendProblem(response, {
        status: 400,
        title: 'Invalid leaderboard query',
        errors: validationErrors(query.error),
      });
      return;
    }
    // The same for everyone, but it must be fresh: a player who has just
    // finished a run expects to see it. Stale at once and revalidated every
    // time (the ETag Express sets makes an unchanged board a short 304).
    // Not `no-cache`: Angular's SSR transfer cache skips such responses, and
    // the site would then fetch every board twice.
    response.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    response.json(await leaderboard.board(board.data, query.data.limit));
  });

  return router;
}
