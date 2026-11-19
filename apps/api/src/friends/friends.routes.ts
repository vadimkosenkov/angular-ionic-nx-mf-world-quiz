import {
  friendRequestBodySchema,
  leaderboardBoardIdSchema,
  leaderboardQuerySchema,
  uuidSchema,
} from '@world-quiz/shared/contracts';
import { Router } from 'express';
import { currentUserId } from '../auth/require-auth';
import { sendProblem, validationErrors } from '../http/problem';
import type { LeaderboardService } from '../leaderboard/leaderboard-service';
import type { FriendService } from './friend-service';

/**
 * `/v1/friends` — the signed-in player's own connections. Mounted behind
 * `requireAuth`, and every answer is `no-store`: these are personal lists
 * that change the moment somebody presses a button.
 *
 * A player who is not a friend is answered with **404**, not 403: whether
 * an id exists is itself private, and a wrong answer here would turn the
 * endpoint into a way of testing ids.
 */
export function friendsRouter(
  friends: FriendService,
  leaderboard: LeaderboardService,
): Router {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  const notAFriend = (response: Parameters<typeof sendProblem>[0]) =>
    sendProblem(response, {
      status: 404,
      title: 'Not Found',
      detail: 'No such friend.',
    });

  /** The id in the path, or `null` when it is not even an id. */
  const otherId = (raw: string): string | null => {
    const parsed = uuidSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  };

  router.get('/', async (_request, response) => {
    response.json(await friends.friends(currentUserId(response)));
  });

  router.post('/requests', async (request, response) => {
    const parsed = friendRequestBodySchema.safeParse(request.body);
    if (!parsed.success) {
      sendProblem(response, {
        status: 400,
        title: 'Invalid invite code',
        detail: 'An invite code is 8 characters from Crockford base32.',
        errors: validationErrors(parsed.error),
      });
      return;
    }
    const asked = await friends.request(
      currentUserId(response),
      parsed.data.code,
    );
    if (!asked.ok) {
      if (asked.error === 'self') {
        sendProblem(response, {
          status: 400,
          title: 'Your own invite code',
          detail: 'That code is yours: share it with somebody else.',
        });
        return;
      }
      sendProblem(response, {
        status: 404,
        title: 'Not Found',
        detail: 'Nobody holds that invite code.',
      });
      return;
    }
    response.status(201).json(asked.value);
  });

  // The shared board: the same ranking as the public one, over the player
  // and their friends. Two segments, so it cannot be read as an id.
  router.get('/leaderboards/:board', async (request, response) => {
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
    const members = await friends.boardMembers(currentUserId(response));
    response.json(
      await leaderboard.board(board.data, query.data.limit, members),
    );
  });

  router.get('/:id', async (request, response) => {
    const id = otherId(request.params.id);
    const profile = id
      ? await friends.profile(currentUserId(response), id)
      : null;
    if (!profile) {
      notAFriend(response);
      return;
    }
    response.json(profile);
  });

  router.post('/:id/accept', async (request, response) => {
    const id = otherId(request.params.id);
    const accepted = id
      ? await friends.accept(currentUserId(response), id)
      : null;
    if (!accepted) {
      sendProblem(response, {
        status: 404,
        title: 'Not Found',
        detail: 'No request from that player is waiting.',
      });
      return;
    }
    response.json(accepted);
  });

  // Saying no to a request and ending a friendship are the same act: the
  // row goes, whichever state it was in, and either player may do it.
  router.delete('/:id', async (request, response) => {
    const id = otherId(request.params.id);
    if (id) await friends.remove(currentUserId(response), id);
    response.status(204).end();
  });

  return router;
}
