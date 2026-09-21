import type { Clock } from '@world-quiz/shared/util';
import express, { type ErrorRequestHandler, type Express } from 'express';
import { sendProblem } from './http/problem';
import type { SessionService } from './sessions/session-service';
import { sessionsRouter } from './sessions/sessions.routes';

export interface AppDependencies {
  readonly clock: Clock;
  readonly sessions: SessionService;
  /** Where unexpected errors are reported (the console in production). */
  readonly logError?: (error: unknown) => void;
}

/** Largest accepted JSON body. A 1000-answer session is well below this. */
export const MAX_BODY_SIZE = '256kb';

/**
 * Builds the Express application without starting a server.
 *
 * Keeping construction separate from `listen()` lets API tests exercise the
 * real middleware stack in-process (supertest) and lets tests inject
 * deterministic dependencies such as a manual clock and an in-memory database.
 */
export function createApp({
  clock,
  sessions,
  logError = (error) => console.error('[api] unexpected error', error),
}: AppDependencies): Express {
  const app = express();

  // Do not advertise the framework to clients.
  app.disable('x-powered-by');
  app.use(express.json({ limit: MAX_BODY_SIZE }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', time: new Date(clock.now()).toISOString() });
  });

  app.use('/v1/sessions', sessionsRouter(sessions));

  // Unknown routes answer with an RFC 9457 problem-details body.
  app.use((request, response) => {
    sendProblem(response, {
      status: 404,
      title: 'Not Found',
      detail: `No route matches ${request.method} ${request.path}`,
    });
  });

  // Errors thrown by middleware or handlers. Express 5 forwards rejected
  // promises from async handlers here. Details stay in the server log; the
  // client learns only what it can act on.
  const handleError: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    const type = (error as { type?: string } | null)?.type;
    if (type === 'entity.parse.failed') {
      sendProblem(response, {
        status: 400,
        title: 'Malformed JSON',
        detail: 'The request body is not valid JSON.',
      });
      return;
    }
    if (type === 'entity.too.large') {
      sendProblem(response, {
        status: 413,
        title: 'Payload Too Large',
        detail: `Request bodies are limited to ${MAX_BODY_SIZE}.`,
      });
      return;
    }

    logError(error);
    sendProblem(response, {
      status: 500,
      title: 'Internal Server Error',
      detail: 'The request could not be completed.',
    });
  };
  app.use(handleError);

  return app;
}
