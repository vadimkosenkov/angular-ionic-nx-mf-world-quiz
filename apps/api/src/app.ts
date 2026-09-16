import type { Clock } from '@world-quiz/shared/util';
import express, { type Express } from 'express';

export interface AppDependencies {
  readonly clock: Clock;
}

/**
 * Builds the Express application without starting a server.
 *
 * Keeping construction separate from `listen()` lets API tests exercise the
 * real middleware stack in-process (supertest) and lets tests inject
 * deterministic dependencies such as a manual clock.
 */
export function createApp({ clock }: AppDependencies): Express {
  const app = express();

  // Do not advertise the framework to clients.
  app.disable('x-powered-by');

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', time: new Date(clock.now()).toISOString() });
  });

  // Unknown routes answer with an RFC 9457 "problem details" body. The full
  // error-handling strategy (validation, auth, unexpected errors, request IDs)
  // arrives with the backend phase.
  app.use((request, response) => {
    response
      .status(404)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: `No route matches ${request.method} ${request.path}`,
      });
  });

  return app;
}
