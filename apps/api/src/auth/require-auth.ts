import type { Clock } from '@world-quiz/shared/util';
import type { RequestHandler, Response } from 'express';
import { sendProblem } from '../http/problem';
import type { AccessTokens } from './access-tokens';

/** The signed-in user of a request that passed `requireAuth`. */
export function currentUserId(response: Response): string {
  const userId: unknown = response.locals['userId'];
  if (typeof userId !== 'string') {
    throw new Error('currentUserId() used on a route without requireAuth');
  }
  return userId;
}

/**
 * Admits requests with a valid `Authorization: Bearer <access token>`.
 * Anything else is 401 with `WWW-Authenticate: Bearer`, telling the client to
 * refresh its token or sign in again.
 */
export function requireAuth(
  accessTokens: AccessTokens,
  clock: Clock,
): RequestHandler {
  return async (request, response, next) => {
    const header = request.headers.authorization ?? '';
    const match = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header);
    const userId = match
      ? await accessTokens.verify(match[1] as string, clock.now())
      : null;

    if (!userId) {
      response.setHeader('WWW-Authenticate', 'Bearer');
      sendProblem(response, {
        status: 401,
        title: 'Unauthorized',
        detail: 'Sign in, or refresh the access token.',
      });
      return;
    }
    response.locals['userId'] = userId;
    next();
  };
}
