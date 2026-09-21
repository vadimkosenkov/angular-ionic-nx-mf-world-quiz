import {
  submitSessionRequestSchema,
  uuidSchema,
} from '@world-quiz/shared/contracts';
import { Router } from 'express';
import { currentUserId } from '../auth/require-auth';
import { sendProblem, validationErrors } from '../http/problem';
import type { SessionService } from './session-service';

/**
 * `/v1/sessions` — recording finished quiz sessions. Mounted behind
 * `requireAuth`: every session belongs to the signed-in player, and a player
 * can read back only their own sessions.
 */
export function sessionsRouter(sessions: SessionService): Router {
  const router = Router();

  router.post('/', async (request, response) => {
    const parsed = submitSessionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendProblem(response, {
        status: 400,
        title: 'Invalid session',
        detail: 'The request body does not match the session contract.',
        errors: validationErrors(parsed.error),
      });
      return;
    }

    const outcome = await sessions.submit(parsed.data, currentUserId(response));
    switch (outcome.kind) {
      case 'created':
        response
          .status(201)
          .location(`${request.baseUrl}/${outcome.result.id}`)
          .json(outcome.result);
        return;
      case 'duplicate':
        // Idempotent retry: the stored result, not a second session.
        response.status(200).json(outcome.result);
        return;
      case 'owner-missing':
        sendProblem(response, {
          status: 401,
          title: 'Unauthorized',
          detail: 'This account no longer exists.',
        });
        return;
      case 'conflict':
        sendProblem(response, {
          status: 409,
          title: 'Session id already used',
          detail: 'A different session was already recorded with this id.',
        });
        return;
      case 'rejected':
        sendProblem(response, {
          type: `urn:world-quiz:session-rejected:${outcome.reason}`,
          status: 422,
          title: 'Session rejected',
          detail: `The session could not be verified: ${outcome.reason}.`,
        });
        return;
    }
  });

  router.get('/:id', async (request, response) => {
    const id = uuidSchema.safeParse(request.params.id);
    if (!id.success) {
      sendProblem(response, {
        status: 400,
        title: 'Invalid session id',
        detail: 'A session id is a UUID.',
      });
      return;
    }

    const result = await sessions.find(id.data, currentUserId(response));
    if (!result) {
      sendProblem(response, {
        status: 404,
        title: 'Not Found',
        detail: 'No session with this id.',
      });
      return;
    }
    response.json(result);
  });

  return router;
}
